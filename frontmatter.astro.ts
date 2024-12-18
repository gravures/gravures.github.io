/**
 * code borrowed from <https://github.com/estruyf/vscode-front-matter/blob/main/ssg-scripts/astro.collections.mjs>
 *
*/
import zod, { type ZodTypeAny } from 'astro/zod'
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "path"


const { ZodArray, ZodBigInt, ZodBoolean, ZodDate, ZodDefault, ZodEffects, ZodEnum, ZodNumber, ZodObject, ZodOptional, ZodString, ZodUnion } = zod


type FmZodString = zod.ZodString & {
    fmFieldType?: string
}

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


/**
 * Process the Zod field.
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


/*
*  Writes config files in the .frontmatter/config directory.
*/
function writeFrontMatterConfig(
    // HACK: Astro discourages using node module but does
    //       not provide an api for writing files.
    object: object, name: string, fmProperty: string): void {
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


type AstroSchema = ZodTypeAny | Function
type SchemaObject = {
    name: string
    type: string
    fields: ZodFieldInfo[]
}

type FmSchema = {
    schemaId: number
    schemas: AstroSchema[]
    object: SchemaObject
}

enum CollectionType {
    Content,
    Data
}

type AstroCollection = {
    name: string
    type: CollectionType
    schema: AstroSchema
    base: string
    glob: string
}


function processAstroSchema(schema: FmSchema): FmSchema {
    const tmp = schema.schemas[schema.schemaId]
    const _schema: ZodTypeAny =
        (typeof tmp === "function")
            ? tmp({
                image() {
                    const field: FmZodString = zod.string()
                    field.fmFieldType = "image"
                    return field
                }
            })
            : tmp
    schema.object.fields = extractFieldInfoFromShape(_schema)
    schema.object.type = "content"

    return schema
}


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
        // excludePaths: [`!(${item.glob})`]
    },
        item.name,
        "content.pageFolders"
    )
}


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


async function syncCollections(...collections: AstroCollection[]): Promise<void> {
    // Get all the schemas referenced by the collections
    const astroSchemas: AstroSchema[] =
        [...new Set(collections.map((item) => {
            return item.schema
        }))]

    // Process the schemas
    const schemas: FmSchema[] = astroSchemas.map((schema, index) => {
        return processAstroSchema({
            schemaId: index,
            schemas: astroSchemas,
            object: {
                name: `astro_schema_${index}`,
                type: "content",
                fields: []
            }
        })
    })

    // Process the collections
    try {
        for (const item of collections) {
            const _schema = schemas[astroSchemas.indexOf(item.schema)]
            if (item.type === CollectionType.Content)
                writeContentTypes(item, _schema)
            else
                writeDataTypes(item, _schema)
        }
        console.log("[syncCollections] Collections generated successfully")
    }
    catch (error: any) {
        console.log(`[syncCollections] ${error.message}`)
    }
}


export { CollectionType, syncCollections }
export type { AstroCollection }

