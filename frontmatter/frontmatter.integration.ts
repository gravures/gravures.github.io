import type { AstroIntegration, HookParameters } from "astro"
import type { Loader, LoaderContext } from "astro/loaders"
import { file, glob } from "astro/loaders"
import type { ZodSchema, ZodTypeAny } from "astro/zod"
import zod from 'astro/zod'
import crypto from "crypto"
import { console } from "inspector"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "path"

const { ZodArray, ZodBigInt, ZodBoolean, ZodDate, ZodDefault, ZodEffects, ZodEnum, ZodNumber, ZodObject, ZodOptional, ZodString, ZodUnion } = zod


interface ZodFieldInfo {
    name: string
    description?: string
    defaultValue: any
    type: string
    required: boolean
    fields?: ZodFieldInfo[]
    single?: boolean
    multiple?: boolean
    dateFormat?: string
    isModifiedDate?: boolean
    isPublishedDate?: boolean
    choices?: string[]
};

type ZodField = {
    type: ZodTypeAny,
    isOptional: boolean,
    defaultValue?: string
}

type FmZodString = zod.ZodString & {
    fmFieldType?: string
}

enum CollectionType {
    Content,
    Data,
    Media
}

type AstroCollection = {
    name: string
    type: CollectionType
    schema: ZodSchema
    base: string
    glob: string
}


class FmSchema {
    private static schemas: ZodSchema[] = []
    private static processed: ZodFieldInfo[][] = []

    readonly id: number
    readonly name: string
    readonly type: string
    readonly fields: ZodFieldInfo[]

    constructor(schema: ZodSchema) {
        this.id = this.processSchema(schema)
        this.name = `astro_schema_${this.id}`
        this.type = "content"
        this.fields = FmSchema.processed[this.id]
    }

    /**
    * Astro schema pre-processing.
    */
    private processSchema(schema: ZodSchema): number {
        let id = FmSchema.schemas.indexOf(schema)

        if (id === -1) {
            FmSchema.schemas.push(schema)
            id = FmSchema.schemas.length - 1
            const _schema = FmSchema.schemas[id]

            /**
            * const _schema: ZodTypeAny =
            *    (typeof tmp === "function")
            *        ? tmp({
            *            image() {
            *                const field: FmZodString = zod.string()
            *                field.fmFieldType = "image"
            *                return field
            *            }
            *        })
            *        : tmp
            */
            FmSchema.processed.push(extractFieldInfoFromShape(_schema))
        }
        return id
    }

    public get object() {
        return {
            name: this.name,
            type: this.type,
            fields: this.fields
        }
    }
}


/**
 * Process a Zod field.
 *
 * Handle various type transformations and assignments.
 */
function getField(field: ZodTypeAny, isOptional: boolean = false, defaultValue?: string): ZodField {
    if (field instanceof ZodOptional)
        return getField(field.unwrap(), true, defaultValue)

    if (field instanceof ZodEffects)
        return getField(field.sourceType(), isOptional, defaultValue)

    if (field instanceof ZodUnion)
        return getField(field._def.options[0], isOptional, defaultValue)

    if (field instanceof ZodDefault) {
        // https://github.com/colinhacks/zod/blob/master/README.md#default
        // https://github.com/sachinraja/zod-to-ts/blob/main/src/index.ts
        return getField(field._def.innerType, true, field.parse(undefined))
    }

    return {
        type: field,
        isOptional: isOptional,
        defaultValue: defaultValue,
    }
}


/**
 * Generate the field information.
 */
function generateFieldInfo(name: string, type: ZodTypeAny): ZodFieldInfo {
    let description = type.description
    let defaultValue = undefined

    const {
        type: fieldType,
        isOptional: isFieldOptional,
        defaultValue: fieldDefaultValue
    } = getField(type, false, defaultValue)

    const fieldInfo: ZodFieldInfo = {
        name: name,
        description: description,
        defaultValue: fieldDefaultValue,
        type: fieldType._def.typeName,
        required: !isFieldOptional
    }

    if (fieldType instanceof ZodObject) {
        const subFields = extractFieldInfoFromShape(fieldType)
        fieldInfo.fields = subFields
    }

    if (fieldType instanceof ZodEffects) {
        fieldInfo.type = fieldType.sourceType().fmFieldType
    }

    if (fieldType instanceof ZodString) {
        // String
        if (fieldType._def.checks && fieldType._def.checks.length > 0) {
            // https://github.com/StefanTerdell/zod-to-json-schema/blob/master/src/parsers/string.ts
            const check = fieldType._def.checks.pop()
            fieldInfo.type = check ? check.kind : "string"
        } else {
            fieldInfo.type = "string"
        }
        fieldInfo.single = true
    } else if (fieldType instanceof ZodNumber) {
        // Number
        fieldInfo.type = "number"
    } else if (fieldType instanceof ZodBigInt) {
        fieldInfo.type = "number"
    } else if (fieldType instanceof ZodBoolean) {
        // Boolean
        fieldInfo.type = "boolean"
    } else if (fieldType instanceof ZodDate) {
        // Date
        fieldInfo.type = "datetime"
        fieldInfo.dateFormat = "yyyy-MM-dd"
        if (fieldInfo.name.toLowerCase().includes("modif"))
            fieldInfo.isModifiedDate = true
        else if (fieldInfo.name.toLowerCase().includes("publish"))
            fieldInfo.isPublishedDate = true
    } else if (fieldType instanceof ZodArray) {
        // List
        fieldInfo.type = "list"
    } else if (fieldType instanceof ZodEnum) {
        // Enum
        fieldInfo.type = "choice"
        fieldInfo.multiple = false
        fieldInfo.choices = fieldType.options
    } else if (fieldInfo.name.toLowerCase().includes('image')) {
        // Image
        fieldInfo.type = "image"
    } else {
        // Unsuppoted
        console.log(`[DEBUG]: ${fieldType}`)
    }

    return fieldInfo
}


/**
 * Parse the scheme into an array of fields.
 *
 * Return an empty array if the type is not of the expected type.
 */
function extractFieldInfoFromShape(type: ZodTypeAny): ZodFieldInfo[] {
    if (type instanceof ZodOptional)
        type = type.unwrap()

    if (!(type instanceof ZodObject))
        return []

    // Iterate through the shape properties
    // https://github.com/sachinraja/zod-to-ts/blob/1389b33557bcca8a02da66cd5c48efbe7579720c/src/index.ts#L134
    const properties: [string, ZodTypeAny][] = Object.entries(type._def.shape())
    const fieldInfoList = properties.map(([fieldName, fieldShape]) => {
        return generateFieldInfo(fieldName, fieldShape)
    })

    return fieldInfoList
}


/**
 * Writes config files in the .frontmatter/config directory.
 */
function writeFrontMatterConfig(object: object, name: string, fmProperty: string): void {
    // HACK: Astro discourages using node module but does
    //       not provide an api for writing files.
    const baseConfigPath = "./.frontmatter/config"

    try {
        // const configSchema = "https://frontmatter.codes/config/taxonomy.contenttypes.schema.json";
        const configPath = path.join(baseConfigPath, ...fmProperty.split("."))
        const jsonStr = JSON.stringify(object, null, 2)

        mkdirSync(configPath, { recursive: true })
        writeFileSync(path.join(configPath, `${name}.json`), jsonStr)
    } catch (error: any) {
        throw Error(error.message)
    }
}


/**
 *  Writes .frontmatter/config/taxonomy/contenttypes/*.json
 *  and .frontmatter/config/content/pageFolders/*.json files.
 */
function writeContentTypes(item: AstroCollection, schema: FmSchema): void {
    writeFrontMatterConfig(
        schema.object,
        schema.object.name,
        "taxonomy.contenttypes"
    )
    writeFrontMatterConfig({
        title: item.name,
        path: path.join("[[workspace]]", item.base),
        contentTypes: [schema.object.name],
        // FIXME: excludePaths: [`!(${item.glob})`]
    },
        item.name,
        "content.pageFolders"
    )
}


/**
 *  Writes .frontmatter/config/data/types/*.json
 *  and .frontmatter/config/data/folders/*.json files.
 */
function writeDataTypes(item: AstroCollection, schema: FmSchema): void {
    const jsonFile = path.join(".", ".astro", "collections", `${item.name}.schema.json`)
    const jsonSchema = JSON.parse(readFileSync(jsonFile, "utf-8"))

    writeFrontMatterConfig({
        id: schema.object.name,
        schema: jsonSchema["definitions"][item.name],
    },
        item.name,
        "data.types"
    )

    if (path.dirname(item.base) === item.base) {
        writeFrontMatterConfig({
            id: item.name,
            path: path.join("[[workspace]]", item.base),
            type: schema.object.name,
            fileType: "json",
            singleEntry: true,
            enableFileCreation: true,
        },
            item.name,
            "data.folders"
        )
    } else {
        writeFrontMatterConfig({
            id: item.name,
            file: path.join("[[workspace]]", item.base),
            type: schema.object.name,
            title: item.name,
            fileType: "json",
            singleEntry: false,
        },
            item.name,
            "data.files"
        )
    }
}


/**
 *
 */
function writeMediaTypes(item: AstroCollection, schema: FmSchema): void {
    // TODO: implements writeMediaTypes!
}


const Store: {
    hashMediaDb: string,
    collections: AstroCollection[],
} = {
    hashMediaDb: "",
    collections: [],
}


/**
 * Synchronize a single Astro collection with Frontmatter data types configuration.
 */
async function syncCollection(collection: AstroCollection): Promise<void> {
    const schema = new FmSchema(collection.schema)
    try {
        switch (collection.type) {
            case CollectionType.Content:
                writeContentTypes(collection, schema)
            case CollectionType.Data:
                writeDataTypes(collection, schema)
            case CollectionType.Media:
                writeMediaTypes(collection, schema)
        }
        console.log("[syncCollections] Collections generated successfully")
    } catch (error: any) {
        console.log(`[syncCollections] ${error.message}`)
    }
}


/**
 *  Returns the hash string of a file.
 *
 *  Returns an empty string if the file does not exist.
 */
function hashFile(path: string): string {
    if (!existsSync(path))
        return ""
    return crypto.createHash("sha256").update(readFileSync(path, "utf-8")).digest("hex")
}


async function syncMediaDB({ config, addWatchFile, command, isRestart, logger }: HookParameters<"astro:config:setup">) {
    if (command === "dev") {
        const mediaDb = path.join(config.root.pathname, ".frontmatter/database/mediaDb.json")

        if (!isRestart) {
            Store.hashMediaDb = hashFile(mediaDb)
            addWatchFile(mediaDb)
        } else {
            const _hash = hashFile(mediaDb)
            if (_hash !== Store.hashMediaDb) {
                logger.info("FrontMatter Media database has changed. Syncing...")
                Store.hashMediaDb = _hash
            }
        }
    }
}


/**
 * Astro Integration entry point
 */
export default function frontmatterIntegration(): AstroIntegration {
    return {
        name: "frontmatter-integration",
        hooks: {
            "astro:config:setup": syncMediaDB,
            "astro:config:done": ({ logger }) => {
                logger.info("FrontMatter integration ready ;)")
            },
            "astro:server:setup": async ({ logger, refreshContent }) => {
                // await refreshContent({ loaders: ["file", "glob"] })
                logger.info("FrontMatter server ok ;)")
            }
        }
    }
}


/**
 * Returns a loader that syncs the content of a collection.
 */
function syncLoader(schema: ZodSchema, loader: typeof file | typeof glob, ...options: any[]): Loader {
    const _loader = loader(...options)

    const collection: Partial<AstroCollection> = {
        type: (loader instanceof glob) ? CollectionType.Content : CollectionType.Data,
        schema: schema,
        base: (loader instanceof glob) ? options[0].base : options[0],
        glob: (loader instanceof glob) ? options[0].pattern : "*.json",  // TODO: file loader glob?
    }

    return {
        name: `syncing-${loader.name}`,
        load: async (context: LoaderContext): Promise<void> => {
            collection.name = context.collection

            context.logger.info(`syncing ${context.collection}...`)
            await syncCollection(collection as AstroCollection)
            return await _loader.load(context)
        },
        schema: schema,
    }
}


export { syncLoader }
