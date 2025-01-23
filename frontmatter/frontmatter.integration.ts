import type { AstroIntegrationLogger } from "astro"
import type { Loader, LoaderContext } from "astro/loaders"
import { file, glob } from "astro/loaders"
import type { ZodSchema, ZodTypeAny } from "astro/zod"
import zod from "astro/zod"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "path"
import { zodToJsonSchema } from "zod-to-json-schema"

const { ZodArray, ZodBigInt, ZodBoolean, ZodDate, ZodDefault, ZodEffects, ZodEnum, ZodNumber, ZodObject, ZodOptional, ZodString, ZodUnion } = zod


interface ZodFieldInfo {
    name: string
    description?: string
    defaultValue: any
    type: string
    required?: boolean
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


class Schema {
    private static schemas: ZodSchema[] = []
    private static processed: any[] = []

    readonly id: number
    readonly name: string

    constructor(schema: ZodSchema, name?: string) {
        this.id = this.register(schema)
        this.name = (name) ? name : `astro_schema_${this.id}`
    }

    public get fmSchema(): { name: string, type: string, fields: ZodFieldInfo[] } {
        return {
            name: this.name,
            type: "content",
            fields: this.fields
        }
    }

    public get zodSchema(): ZodSchema {
        return Schema.schemas[this.id]
    }

    public get jsonSchema(): any {
        return zodToJsonSchema(
            this.zodSchema,
            { name: this.name, dateStrategy: "format:date" }
        )
    }

    private register(schema: ZodSchema): number {
        let id = Schema.schemas.indexOf(schema)
        if (id === -1) {
            Schema.schemas.push(schema)
            Schema.processed.push(null)
            id = Schema.schemas.length - 1
        }
        return id
    }

    /**
    * Astro schema processing.
    */
    private get fields(): ZodFieldInfo[] {
        const _schema = Schema.schemas[this.id]
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
        if (Schema.processed[this.id] === null)
            Schema.processed[this.id] = (this.extractFieldInfoFromShape(_schema))
        return Schema.processed[this.id]
    }

    /**
     * Parse the scheme into an array of fields.
     *
     * Return an empty array if the type is not of the expected type.
     */
    private extractFieldInfoFromShape(type: ZodTypeAny): ZodFieldInfo[] {
        if (type instanceof ZodOptional)
            type = type.unwrap()

        if (!(type instanceof ZodObject))
            return []

        // Iterate through the shape properties
        // https://github.com/sachinraja/zod-to-ts/blob/1389b33557bcca8a02da66cd5c48efbe7579720c/src/index.ts#L134
        const properties: [string, ZodTypeAny][] = Object.entries(type._def.shape())
        const fieldInfoList = properties.map(([fieldName, fieldShape]) => {
            return this.generateFieldInfo(fieldName, fieldShape)
        })

        return fieldInfoList
    }

    /**
     * Generate the field information.
     */
    private generateFieldInfo(name: string, type: ZodTypeAny): ZodFieldInfo {
        let description = type.description
        let defaultValue = undefined

        const {
            type: fieldType,
            isOptional: isFieldOptional,
            defaultValue: fieldDefaultValue
        } = this.getField(type, false, defaultValue)

        const fieldInfo: ZodFieldInfo = {
            name: name,
            description: description,
            defaultValue: fieldDefaultValue,
            type: fieldType._def.typeName,
            required: !isFieldOptional
        }

        if (fieldType instanceof ZodObject) {
            const subFields = this.extractFieldInfoFromShape(fieldType)
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
            // Unssuppoted
            console.log(`[DEBUG]: ${fieldType}`)
        }

        return fieldInfo
    }

    /**
     * Process a Zod field.
     *
     * Handle various type transformations and assignments.
     */
    private getField(field: ZodTypeAny, isOptional: boolean = false, defaultValue?: string): ZodField {
        if (field instanceof ZodOptional)
            return this.getField(field.unwrap(), true, defaultValue)

        if (field instanceof ZodEffects)
            return this.getField(field.sourceType(), isOptional, defaultValue)

        if (field instanceof ZodUnion)
            return this.getField(field._def.options[0], isOptional, defaultValue)

        if (field instanceof ZodDefault) {
            // https://github.com/colinhacks/zod/blob/master/README.md#default
            // https://github.com/sachinraja/zod-to-ts/blob/main/src/index.ts
            return this.getField(field._def.innerType, true, field.parse(undefined))
        }

        return {
            type: field,
            isOptional: isOptional,
            defaultValue: defaultValue,
        }
    }
}


abstract class BaseLoader implements Loader {
    private static readonly baseConfigPath = "./.frontmatter/config"
    private static isClean: boolean = false

    protected readonly _loader: Loader
    protected readonly _schema: ZodSchema
    protected collection: Partial<AstroCollection>

    protected constructor(schema: ZodSchema, loader: Loader, collection: Partial<AstroCollection>) {
        BaseLoader.clearFrontMatterConfig()
        this._loader = loader
        this._schema = schema
        this.collection = collection
    }

    public static clearFrontMatterConfig(): void {
        if (BaseLoader.isClean)
            return

        for (const prop of ["content", "data", "media", "taxonomy"]) {
            const configPath = path.join(BaseLoader.baseConfigPath, prop)
            rmSync(configPath, { recursive: true, force: true })
        }
        BaseLoader.isClean = true
    }

    abstract load(context: LoaderContext): Promise<void>

    get schema(): ZodSchema {
        return this._schema
    }

    get name(): string {
        return `${this.constructor.name}(${this._loader.name})`
    }

    /**
     * Writes config files in the .frontmatter/config directory.
     */
    protected writeFrontMatterConfig(object: object, name: string, fmProperty: string): void {
        try {
            const configSchema = `https://frontmatter.codes/config/${fmProperty.toLowerCase()}.schema.json`
            const configPath = path.join(BaseLoader.baseConfigPath, ...fmProperty.split("."))
            const o = Object.assign({ $schema: configSchema }, object)
            const jsonStr = JSON.stringify(o, null, 2)

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
    protected writeContentTypes(schema: Schema): void {
        const collection = this.collection as AstroCollection
        this.writeFrontMatterConfig(
            schema.fmSchema,
            schema.name,
            "taxonomy.contenttypes"
        )
        this.writeFrontMatterConfig({
            title: collection.name,
            path: path.join("[[workspace]]", collection.base),
            contentTypes: [schema.name],
            // FIXME: excludePaths: [`!(${item.glob})`]
        },
            collection.name,
            "content.pageFolders"
        )
    }

    /**
     *  Writes .frontmatter/config/data/types/*.json
     *  and .frontmatter/config/data/[files|folders]/*.json files.
     */
    protected writeDataTypes(schema: Schema): void {
        const collection = this.collection as AstroCollection
        const astroSchema = schema.jsonSchema

        this.writeFrontMatterConfig({
            id: schema.name,
            schema: astroSchema["definitions"][schema.name],
        },
            collection.name,
            "data.types"
        )

        if (path.dirname(collection.base) === collection.base) {
            this.writeFrontMatterConfig({
                id: collection.name,
                path: path.join("[[workspace]]", collection.base),
                type: schema.name,
                fileType: "json",
                singleEntry: true,
                enableFileCreation: true,
            },
                collection.name,
                "data.folders"
            )
        } else {
            this.writeFrontMatterConfig({
                id: collection.name,
                file: path.join("[[workspace]]", collection.base),
                type: schema.name,
                title: collection.name,
                fileType: "json",
                singleEntry: false,
            },
                collection.name,
                "data.files"
            )
        }
    }

    /**
     *  Writes .frontmatter/config/media/contenttypes/*.json
     */
    protected writeMediaType(schema: Schema): void {
        const obj = {
            name: schema.name,
            fileTypes: ["png", "jpg", "jpeg", "gif"],
            fields: schema.fmSchema.fields.map(field => {
                let tmp = { ...field }
                delete tmp.required
                return tmp
            })
        }
        this.writeFrontMatterConfig(
            obj,
            schema.name,
            "media.contenttypes"
        )
    }
}


/**
 * A Loader that syncs the content of a collection.
 */
class SyncLoader extends BaseLoader {

    constructor(schema: ZodSchema, loader: typeof file | typeof glob, ...options: [any, ...any[]]) {
        const _loader = loader(...options)
        const collection = (_loader.name === "glob-loader")
            ? {
                type: CollectionType.Content,
                schema: schema,
                base: options[0].base,
                glob: options[0].pattern,
            }
            : {
                type: CollectionType.Data,
                schema: schema,
                base: options[0],
                glob: "*.json",
            }
        super(schema, _loader, collection)
    }

    /**
     * Loads the collection in the Astro dataStore.
     */
    public load = async (context: LoaderContext): Promise<void> => {
        this.collection.name = context.collection
        context.logger.info(`syncing ${context.collection}...`)
        await this.syncCollection(context.logger)
        return await this._loader.load(context)
    }

    /**
     * Synchronize the collection's schema with
     * the Frontmatter data types configuration.
     */
    private async syncCollection(logger: AstroIntegrationLogger): Promise<void> {
        const schema = new Schema(this.collection.schema as ZodSchema)
        try {
            switch (this.collection.type) {
                case CollectionType.Content:
                    this.writeContentTypes(schema)
                    break
                case CollectionType.Data:
                    this.writeDataTypes(schema)
                    break
            }
            logger.info(`syncCollections(${this.collection.name}): Collections generated successfully`)
        } catch (error: any) {
            logger.error(`syncCollections(${this.collection.name}): ${error.message}`)
        }
    }
}


/**
 * MediaDB Synchronization Loader Class
 */
class MediaDbSync extends BaseLoader {
    private static _mediaDb: string = ".frontmatter/database/mediaDb.json"
    private static _schema: ZodSchema
    private static _dataSchema: ZodSchema

    private _context?: LoaderContext
    private _dataFile: string
    private _mediaFolder: string
    private _lock: boolean

    public static setSchema(schema: ZodSchema): void {
        MediaDbSync._schema = schema
        MediaDbSync._dataSchema = (MediaDbSync._schema as zod.ZodObject<any>).extend({
            id: zod.string(),
            src: zod.string(),
        })
    }

    constructor(dataFile: string, mediaFolder: string) {
        if (!MediaDbSync._schema)
            throw new Error("MediaDbSync: schema not set")

        if (!existsSync(dataFile))
            writeFileSync(dataFile, "[]")

        const _loader = file(dataFile)
        const collection: Partial<AstroCollection> = {
            type: CollectionType.Data,
            schema: MediaDbSync._schema,
            base: dataFile,
            glob: "*.json",
        }

        super(MediaDbSync._schema, _loader, collection)
        this._dataFile = dataFile
        this._mediaFolder = mediaFolder
        this._lock = false
    }

    /**
     * Loads the collection in the Astro dataStore.
     */
    public load = async (context: LoaderContext): Promise<void> => {
        this._context = context
        this.collection.name = context.collection

        this.writeMediaType(new Schema(this.schema, "default"))
        this.writeDataTypes(new Schema(MediaDbSync._dataSchema))
        await this.syncMediaDb()

        if (context.watcher)
            context.watcher.on("change", this.sync)

        // loads the collection in dataStore
        await this._loader.load(this._context)
    }

    /**
     * Loads the Frontmatter Media Database as a Map.
     */
    private loadMediaDb(): Map<string, any> {
        let db
        try {
            db = JSON.parse(readFileSync(MediaDbSync._mediaDb, "utf-8"))
            for (const _p of this._mediaFolder.split(path.sep))
                if (_p in db)
                    db = db[_p]
                else {
                    db = {}
                    break
                }
        } catch (Error) {
            setTimeout(this.loadMediaDb, 100)
        }
        return new Map(Object.entries(db))
    }

    /**
     * Loads the user defined data file as a Map.
     */
    private loadData(): Map<string, any> {
        const obj = JSON.parse(readFileSync(this._dataFile, "utf-8"))
        const map = new Map()
        for (const item of obj)
            if (item.id)
                map.set(item.id, item)
        return map
    }

    /**
     *
     */
    public sync = async (file: string): Promise<void> => {
        if (!this._lock) {
            if (file.includes(MediaDbSync._mediaDb)) {
                await this.syncData()
                this._lock = true
            } else if (file.includes(this._dataFile)) {
                await this.syncMediaDb()
                this._lock = true
            }
        } else {
            this._lock = false
        }
    }

    /**
     * Synchronize the Frontmatter Media Database
     * against the Astro user defined data file.
     */
    private async syncMediaDb(): Promise<void> {
        this._context?.logger.info(`syncing frontmatter media database...`)

        const data = this.loadData()
        const db = JSON.parse(readFileSync(MediaDbSync._mediaDb, "utf-8"))
        const _path = this._mediaFolder.split(path.sep)

        data.forEach((value, key) => {
            delete value.id
            delete value.src
        })
        let o = Object.fromEntries(data)
        for (let i = _path.length - 1; i > 0; i--)
            o = { [_path[i]]: o }
        db[_path[0]] = o

        writeFileSync(MediaDbSync._mediaDb, JSON.stringify(db))
    }

    /**
     * Synchronize the Astro user defined data file
     * against the Frontmatter Media Database.
     */
    private async syncData(): Promise<void> {
        this._context?.logger.info(`Syncing data for <${this.collection.name}>...`)
        const db = this.loadMediaDb()
        const data = this.loadData()

        for (const [key, val] of db) {
            val["src"] = path.join(this._mediaFolder, key)
            val["id"] = key
            data.set(key, val)
        }

        writeFileSync(
            this._dataFile,
            JSON.stringify(Array.from(data.values()), null, 2)
        )
    }
}


export { MediaDbSync, SyncLoader as syncLoader }
