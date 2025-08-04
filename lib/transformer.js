"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const helpers_1 = require("./helpers");
const writeFileSafely_1 = require("./utils/writeFileSafely");
const writeIndexFile_1 = require("./utils/writeIndexFile");
class Transformer {
    constructor(params) {
        var _a, _b, _c, _d, _e, _f;
        this.schemaImports = new Set();
        this.hasJson = false;
        this.name = (_a = params.name) !== null && _a !== void 0 ? _a : '';
        this.fields = (_b = params.fields) !== null && _b !== void 0 ? _b : [];
        this.models = (_c = params.models) !== null && _c !== void 0 ? _c : [];
        this.modelOperations = (_d = params.modelOperations) !== null && _d !== void 0 ? _d : [];
        this.aggregateOperationSupport = (_e = params.aggregateOperationSupport) !== null && _e !== void 0 ? _e : {};
        this.enumTypes = (_f = params.enumTypes) !== null && _f !== void 0 ? _f : [];
    }
    static setOutputPath(outPath) {
        this.outputPath = outPath;
    }
    static setIsGenerateSelect(isGenerateSelect) {
        this.isGenerateSelect = isGenerateSelect;
    }
    static setIsGenerateInclude(isGenerateInclude) {
        this.isGenerateInclude = isGenerateInclude;
    }
    static getOutputPath() {
        return this.outputPath;
    }
    static setPrismaClientOutputPath(prismaClientCustomPath) {
        this.prismaClientOutputPath = prismaClientCustomPath;
        this.isCustomPrismaClientOutputPath =
            prismaClientCustomPath !== '@prisma/client';
    }
    static setPrismaClientProvider(provider) {
        this.prismaClientProvider = provider;
    }
    static setPrismaClientConfig(config) {
        this.prismaClientConfig = config;
    }
    static getPrismaClientProvider() {
        return this.prismaClientProvider;
    }
    static getPrismaClientConfig() {
        return this.prismaClientConfig;
    }
    /**
     * Determines the schemas directory path based on the output path.
     * If the output path already ends with 'schemas', use it directly.
     * Otherwise, append 'schemas' to the output path.
     */
    static getSchemasPath() {
        const normalizedOutputPath = path_1.default.normalize(this.outputPath);
        const pathSegments = normalizedOutputPath.split(path_1.default.sep);
        const lastSegment = pathSegments[pathSegments.length - 1];
        if (lastSegment === 'schemas') {
            return this.outputPath;
        }
        return path_1.default.join(this.outputPath, 'schemas');
    }
    static async generateIndex() {
        const indexPath = path_1.default.join(Transformer.getSchemasPath(), 'index.ts');
        await (0, writeIndexFile_1.writeIndexFile)(indexPath);
    }
    async generateEnumSchemas() {
        for (const enumType of this.enumTypes) {
            const { name, values } = enumType;
            await (0, writeFileSafely_1.writeFileSafely)(path_1.default.join(Transformer.getSchemasPath(), `enums/${name}.schema.ts`), `${this.generateImportZodStatement()}\n${this.generateExportSchemaStatement(`${name}`, `z.enum(${JSON.stringify(values)})`)}`);
        }
    }
    generateImportZodStatement() {
        return "import { z } from 'zod';\n";
    }
    generateExportSchemaStatement(name, schema) {
        return `export const ${name}Schema = ${schema}`;
    }
    async generateObjectSchema() {
        const zodObjectSchemaFields = this.generateObjectSchemaFields();
        const objectSchema = this.prepareObjectSchema(zodObjectSchemaFields);
        const objectSchemaName = this.resolveObjectSchemaName();
        await (0, writeFileSafely_1.writeFileSafely)(path_1.default.join(Transformer.getSchemasPath(), `objects/${objectSchemaName}.schema.ts`), objectSchema);
    }
    generateObjectSchemaFields() {
        const zodObjectSchemaFields = this.fields
            .map((field) => this.generateObjectSchemaField(field))
            .flatMap((item) => item)
            .map((item) => {
            const [zodStringWithMainType, field, skipValidators] = item;
            const value = skipValidators
                ? zodStringWithMainType
                : this.generateFieldValidators(zodStringWithMainType, field);
            return value.trim();
        });
        return zodObjectSchemaFields;
    }
    generateObjectSchemaField(field) {
        const lines = field.inputTypes;
        if (lines.length === 0) {
            return [];
        }
        let alternatives = lines.reduce((result, inputType) => {
            if (inputType.type === 'String') {
                result.push(this.wrapWithZodValidators('z.string()', field, inputType));
            }
            else if (inputType.type === 'Int') {
                result.push(this.wrapWithZodValidators('z.number().int()', field, inputType));
            }
            else if (inputType.type === 'Float' ||
                inputType.type === 'Decimal') {
                result.push(this.wrapWithZodValidators('z.number()', field, inputType));
            }
            else if (inputType.type === 'BigInt') {
                result.push(this.wrapWithZodValidators('z.bigint()', field, inputType));
            }
            else if (inputType.type === 'Boolean') {
                result.push(this.wrapWithZodValidators('z.boolean()', field, inputType));
            }
            else if (inputType.type === 'DateTime') {
                result.push(this.wrapWithZodValidators('z.coerce.date()', field, inputType));
            }
            else if (inputType.type === 'Json') {
                this.hasJson = true;
                result.push(this.wrapWithZodValidators('jsonSchema', field, inputType));
            }
            else if (inputType.type === 'True') {
                result.push(this.wrapWithZodValidators('z.literal(true)', field, inputType));
            }
            else if (inputType.type === 'Bytes') {
                result.push(this.wrapWithZodValidators('z.instanceof(Uint8Array)', field, inputType));
            }
            else {
                const isEnum = inputType.location === 'enumTypes';
                if (inputType.namespace === 'prisma' || isEnum) {
                    if (inputType.type !== this.name &&
                        typeof inputType.type === 'string') {
                        this.addSchemaImport(inputType.type);
                    }
                    result.push(this.generatePrismaStringLine(field, inputType, lines.length));
                }
            }
            return result;
        }, []);
        if (alternatives.length === 0) {
            return [];
        }
        if (alternatives.length > 1) {
            alternatives = alternatives.map((alter) => alter.replace('.optional()', ''));
        }
        // Check if ALL alternatives already include the field name
        // This happens when inputsLength === 1 for all alternatives
        // We check if alternatives start with the field name pattern (spaces + fieldname + colon)
        const fieldNamePattern = `  ${field.name}:`;
        const allAlternativesHaveFieldName = alternatives.every((alt) => alt.startsWith(fieldNamePattern));
        const fieldName = allAlternativesHaveFieldName
            ? ''
            : fieldNamePattern;
        const opt = !field.isRequired ? '.optional()' : '';
        let resString = alternatives.length === 1
            ? alternatives.join(',\r\n')
            : `z.union([${alternatives.join(',\r\n')}])${opt}`;
        if (field.isNullable) {
            resString += '.nullable()';
        }
        return [[`  ${fieldName} ${resString} `, field, true]];
    }
    wrapWithZodValidators(mainValidator, field, inputType) {
        let line = '';
        line = mainValidator;
        if (inputType.isList) {
            line += '.array()';
        }
        if (!field.isRequired) {
            line += '.optional()';
        }
        return line;
    }
    addSchemaImport(name) {
        this.schemaImports.add(name);
    }
    generatePrismaStringLine(field, inputType, inputsLength) {
        const isEnum = inputType.location === 'enumTypes';
        const { isModelQueryType, modelName, queryName } = this.checkIsModelQueryType(inputType.type);
        const objectSchemaLine = isModelQueryType
            ? this.resolveModelQuerySchemaName(modelName, queryName)
            : `${inputType.type}ObjectSchema`;
        const enumSchemaLine = `${inputType.type}Schema`;
        const schema = inputType.type === this.name
            ? objectSchemaLine
            : isEnum
                ? enumSchemaLine
                : objectSchemaLine;
        const arr = inputType.isList ? '.array()' : '';
        const opt = !field.isRequired ? '.optional()' : '';
        // Only use lazy loading for self-references or complex object schemas that might have circular dependencies
        // Simple enums like SortOrder don't need lazy loading
        const needsLazyLoading = inputType.type === this.name ||
            (!isEnum && inputType.namespace === 'prisma');
        if (needsLazyLoading) {
            return inputsLength === 1
                ? `  ${field.name}: z.lazy((): z.ZodTypeAny => ${schema})${arr}${opt}`
                : `z.lazy((): z.ZodTypeAny => ${schema})${arr}${opt}`;
        }
        else {
            return inputsLength === 1
                ? `  ${field.name}: ${schema}${arr}${opt}`
                : `${schema}${arr}${opt}`;
        }
    }
    generateFieldValidators(zodStringWithMainType, field) {
        const { isRequired, isNullable } = field;
        if (!isRequired) {
            zodStringWithMainType += '.optional()';
        }
        if (isNullable) {
            zodStringWithMainType += '.nullable()';
        }
        return zodStringWithMainType;
    }
    prepareObjectSchema(zodObjectSchemaFields) {
        const objectSchema = `${this.generateExportObjectSchemaStatement(this.addFinalWrappers({ zodStringFields: zodObjectSchemaFields }))}\n`;
        const json = this.generateJsonSchemaImplementation();
        return `${this.generateObjectSchemaImportStatements()}${json}${objectSchema}`;
    }
    generateExportObjectSchemaStatement(schema) {
        let name = this.name;
        let exportName = this.name;
        if (Transformer.provider === 'mongodb') {
            if ((0, helpers_1.isMongodbRawOp)(name)) {
                name = Transformer.rawOpsMap[name];
                exportName = name.replace('Args', '');
            }
        }
        const end = `export const ${exportName}ObjectSchema = Schema`;
        return `const Schema = ${schema};\n\n ${end}`;
    }
    addFinalWrappers({ zodStringFields }) {
        const fields = [...zodStringFields];
        return this.wrapWithZodObject(fields) + '.strict()';
    }
    generateJsonSchemaImplementation() {
        let jsonSchemaImplementation = '';
        if (this.hasJson) {
            jsonSchemaImplementation += `\n`;
            jsonSchemaImplementation += `const literalSchema = z.union([z.string(), z.number(), z.boolean()]);\n`;
            jsonSchemaImplementation += `const jsonSchema = z.lazy((): z.ZodTypeAny =>\n`;
            jsonSchemaImplementation += `  z.union([literalSchema, z.array(jsonSchema.nullable()), z.record(z.string(), jsonSchema.nullable())])\n`;
            jsonSchemaImplementation += `);\n\n`;
        }
        return jsonSchemaImplementation;
    }
    generateObjectSchemaImportStatements() {
        let generatedImports = this.generateImportZodStatement();
        generatedImports += this.generateSchemaImports();
        generatedImports += '\n\n';
        return generatedImports;
    }
    /**
     * Get the file extension to use for imports based on Prisma client configuration
     * For ESM with importFileExtension = "js", we need to add .js extension
     */
    getImportFileExtension() {
        // Check if we're using the new prisma-client generator with ESM configuration
        const isNewPrismaClientGenerator = Transformer.prismaClientProvider === 'prisma-client' ||
            Transformer.prismaClientConfig.moduleFormat !== undefined ||
            Transformer.prismaClientConfig.runtime !== undefined;
        // If using ESM with importFileExtension specified, use that extension
        if (isNewPrismaClientGenerator &&
            Transformer.prismaClientConfig.moduleFormat === 'esm' &&
            Transformer.prismaClientConfig.importFileExtension) {
            return `.${Transformer.prismaClientConfig.importFileExtension}`;
        }
        // Default to no extension for backward compatibility
        return '';
    }
    /**
     * Generate an import statement with the correct file extension for ESM support
     */
    generateImportStatement(importName, importPath) {
        const extension = this.getImportFileExtension();
        return `import { ${importName} } from '${importPath}${extension}'`;
    }
    generateSchemaImports() {
        // Get the file extension to use for imports (for ESM support)
        const importExtension = this.getImportFileExtension();
        return [...this.schemaImports]
            .map((name) => {
            const { isModelQueryType, modelName, queryName } = this.checkIsModelQueryType(name);
            if (isModelQueryType) {
                return `import { ${this.resolveModelQuerySchemaName(modelName, queryName)} } from '../${queryName}${modelName}.schema${importExtension}'`;
            }
            else if (Transformer.enumNames.includes(name)) {
                return `import { ${name}Schema } from '../enums/${name}.schema${importExtension}'`;
            }
            else {
                return `import { ${name}ObjectSchema } from './${name}.schema${importExtension}'`;
            }
        })
            .join(';\r\n');
    }
    checkIsModelQueryType(type) {
        const modelQueryTypeSuffixToQueryName = {
            FindManyArgs: 'findMany',
        };
        for (const modelQueryType of ['FindManyArgs']) {
            if (type.includes(modelQueryType)) {
                const modelQueryTypeSuffixIndex = type.indexOf(modelQueryType);
                return {
                    isModelQueryType: true,
                    modelName: type.substring(0, modelQueryTypeSuffixIndex),
                    queryName: modelQueryTypeSuffixToQueryName[modelQueryType],
                };
            }
        }
        return { isModelQueryType: false };
    }
    resolveModelQuerySchemaName(modelName, queryName) {
        const modelNameCapitalized = modelName.charAt(0).toUpperCase() + modelName.slice(1);
        const queryNameCapitalized = queryName.charAt(0).toUpperCase() + queryName.slice(1);
        return `${modelNameCapitalized}${queryNameCapitalized}Schema`;
    }
    wrapWithZodObject(zodStringFields) {
        let wrapped = '';
        wrapped += 'z.object({';
        wrapped += '\n';
        wrapped += '  ' + zodStringFields;
        wrapped += '\n';
        wrapped += '})';
        return wrapped;
    }
    resolveObjectSchemaName() {
        let name = this.name;
        let exportName = this.name;
        if ((0, helpers_1.isMongodbRawOp)(name)) {
            name = Transformer.rawOpsMap[name];
            exportName = name.replace('Args', '');
        }
        return exportName;
    }
    async generateModelSchemas() {
        for (const modelOperation of this.modelOperations) {
            const { model: modelName, findUnique, findFirst, findMany, 
            // @ts-expect-error - Legacy API compatibility
            createOne, createMany, 
            // @ts-expect-error - Legacy API compatibility
            deleteOne, 
            // @ts-expect-error - Legacy API compatibility
            updateOne, deleteMany, updateMany, 
            // @ts-expect-error - Legacy API compatibility
            upsertOne, aggregate, groupBy, } = modelOperation;
            const model = (0, helpers_1.findModelByName)(this.models, modelName);
            const { selectImport, includeImport, selectZodSchemaLine, includeZodSchemaLine, selectZodSchemaLineLazy, includeZodSchemaLineLazy, } = this.resolveSelectIncludeImportAndZodSchemaLine(model);
            const { orderByImport, orderByZodSchemaLine } = this.resolveOrderByWithRelationImportAndZodSchemaLine(model);
            if (findUnique) {
                const imports = [
                    selectImport,
                    includeImport,
                    this.generateImportStatement(`${modelName}WhereUniqueInputObjectSchema`, `./objects/${modelName}WhereUniqueInput.schema`),
                ];
                await (0, writeFileSafely_1.writeFileSafely)(path_1.default.join(Transformer.getSchemasPath(), `${findUnique}.schema.ts`), `${this.generateImportStatements(imports)}${this.generateExportSchemaStatement(`${modelName}FindUnique`, `z.object({ ${selectZodSchemaLine} ${includeZodSchemaLine} where: ${modelName}WhereUniqueInputObjectSchema })`)}`);
            }
            if (findFirst) {
                const imports = [
                    selectImport,
                    includeImport,
                    orderByImport,
                    this.generateImportStatement(`${modelName}WhereInputObjectSchema`, `./objects/${modelName}WhereInput.schema`),
                    this.generateImportStatement(`${modelName}WhereUniqueInputObjectSchema`, `./objects/${modelName}WhereUniqueInput.schema`),
                    this.generateImportStatement(`${modelName}ScalarFieldEnumSchema`, `./enums/${modelName}ScalarFieldEnum.schema`),
                ];
                await (0, writeFileSafely_1.writeFileSafely)(path_1.default.join(Transformer.getSchemasPath(), `${findFirst}.schema.ts`), `${this.generateImportStatements(imports)}${this.generateExportSchemaStatement(`${modelName}FindFirst`, `z.object({ ${selectZodSchemaLine} ${includeZodSchemaLine} ${orderByZodSchemaLine} where: ${modelName}WhereInputObjectSchema.optional(), cursor: ${modelName}WhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), distinct: z.array(${modelName}ScalarFieldEnumSchema).optional() })`)}`);
            }
            if (findMany) {
                const imports = [
                    selectImport,
                    includeImport,
                    orderByImport,
                    this.generateImportStatement(`${modelName}WhereInputObjectSchema`, `./objects/${modelName}WhereInput.schema`),
                    this.generateImportStatement(`${modelName}WhereUniqueInputObjectSchema`, `./objects/${modelName}WhereUniqueInput.schema`),
                    this.generateImportStatement(`${modelName}ScalarFieldEnumSchema`, `./enums/${modelName}ScalarFieldEnum.schema`),
                ];
                await (0, writeFileSafely_1.writeFileSafely)(path_1.default.join(Transformer.getSchemasPath(), `${findMany}.schema.ts`), `${this.generateImportStatements(imports)}${this.generateExportSchemaStatement(`${modelName}FindMany`, `z.object({ ${selectZodSchemaLineLazy} ${includeZodSchemaLineLazy} ${orderByZodSchemaLine} where: ${modelName}WhereInputObjectSchema.optional(), cursor: ${modelName}WhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), distinct: z.array(${modelName}ScalarFieldEnumSchema).optional()  })`)}`);
            }
            if (createOne) {
                const imports = [
                    selectImport,
                    includeImport,
                    this.generateImportStatement(`${modelName}CreateInputObjectSchema`, `./objects/${modelName}CreateInput.schema`),
                    this.generateImportStatement(`${modelName}UncheckedCreateInputObjectSchema`, `./objects/${modelName}UncheckedCreateInput.schema`),
                ];
                await (0, writeFileSafely_1.writeFileSafely)(path_1.default.join(Transformer.getSchemasPath(), `${createOne}.schema.ts`), `${this.generateImportStatements(imports)}${this.generateExportSchemaStatement(`${modelName}CreateOne`, `z.object({ ${selectZodSchemaLine} ${includeZodSchemaLine} data: z.union([${modelName}CreateInputObjectSchema, ${modelName}UncheckedCreateInputObjectSchema])  })`)}`);
            }
            if (createMany) {
                const imports = [
                    this.generateImportStatement(`${modelName}CreateManyInputObjectSchema`, `./objects/${modelName}CreateManyInput.schema`),
                ];
                await (0, writeFileSafely_1.writeFileSafely)(path_1.default.join(Transformer.getSchemasPath(), `${createMany}.schema.ts`), `${this.generateImportStatements(imports)}${this.generateExportSchemaStatement(`${modelName}CreateMany`, `z.object({ data: z.union([ ${modelName}CreateManyInputObjectSchema, z.array(${modelName}CreateManyInputObjectSchema) ]), ${Transformer.provider === 'postgresql' ||
                    Transformer.provider === 'cockroachdb'
                    ? 'skipDuplicates: z.boolean().optional()'
                    : ''} })`)}`);
            }
            if (deleteOne) {
                const imports = [
                    selectImport,
                    includeImport,
                    this.generateImportStatement(`${modelName}WhereUniqueInputObjectSchema`, `./objects/${modelName}WhereUniqueInput.schema`),
                ];
                await (0, writeFileSafely_1.writeFileSafely)(path_1.default.join(Transformer.getSchemasPath(), `${deleteOne}.schema.ts`), `${this.generateImportStatements(imports)}${this.generateExportSchemaStatement(`${modelName}DeleteOne`, `z.object({ ${selectZodSchemaLine} ${includeZodSchemaLine} where: ${modelName}WhereUniqueInputObjectSchema  })`)}`);
            }
            if (deleteMany) {
                const imports = [
                    this.generateImportStatement(`${modelName}WhereInputObjectSchema`, `./objects/${modelName}WhereInput.schema`),
                ];
                await (0, writeFileSafely_1.writeFileSafely)(path_1.default.join(Transformer.getSchemasPath(), `${deleteMany}.schema.ts`), `${this.generateImportStatements(imports)}${this.generateExportSchemaStatement(`${modelName}DeleteMany`, `z.object({ where: ${modelName}WhereInputObjectSchema.optional()  })`)}`);
            }
            if (updateOne) {
                const imports = [
                    selectImport,
                    includeImport,
                    this.generateImportStatement(`${modelName}UpdateInputObjectSchema`, `./objects/${modelName}UpdateInput.schema`),
                    this.generateImportStatement(`${modelName}UncheckedUpdateInputObjectSchema`, `./objects/${modelName}UncheckedUpdateInput.schema`),
                    this.generateImportStatement(`${modelName}WhereUniqueInputObjectSchema`, `./objects/${modelName}WhereUniqueInput.schema`),
                ];
                await (0, writeFileSafely_1.writeFileSafely)(path_1.default.join(Transformer.getSchemasPath(), `${updateOne}.schema.ts`), `${this.generateImportStatements(imports)}${this.generateExportSchemaStatement(`${modelName}UpdateOne`, `z.object({ ${selectZodSchemaLine} ${includeZodSchemaLine} data: z.union([${modelName}UpdateInputObjectSchema, ${modelName}UncheckedUpdateInputObjectSchema]), where: ${modelName}WhereUniqueInputObjectSchema  })`)}`);
            }
            if (updateMany) {
                const imports = [
                    this.generateImportStatement(`${modelName}UpdateManyMutationInputObjectSchema`, `./objects/${modelName}UpdateManyMutationInput.schema`),
                    this.generateImportStatement(`${modelName}WhereInputObjectSchema`, `./objects/${modelName}WhereInput.schema`),
                ];
                await (0, writeFileSafely_1.writeFileSafely)(path_1.default.join(Transformer.getSchemasPath(), `${updateMany}.schema.ts`), `${this.generateImportStatements(imports)}${this.generateExportSchemaStatement(`${modelName}UpdateMany`, `z.object({ data: ${modelName}UpdateManyMutationInputObjectSchema, where: ${modelName}WhereInputObjectSchema.optional()  })`)}`);
            }
            if (upsertOne) {
                const imports = [
                    selectImport,
                    includeImport,
                    this.generateImportStatement(`${modelName}WhereUniqueInputObjectSchema`, `./objects/${modelName}WhereUniqueInput.schema`),
                    this.generateImportStatement(`${modelName}CreateInputObjectSchema`, `./objects/${modelName}CreateInput.schema`),
                    this.generateImportStatement(`${modelName}UncheckedCreateInputObjectSchema`, `./objects/${modelName}UncheckedCreateInput.schema`),
                    this.generateImportStatement(`${modelName}UpdateInputObjectSchema`, `./objects/${modelName}UpdateInput.schema`),
                    this.generateImportStatement(`${modelName}UncheckedUpdateInputObjectSchema`, `./objects/${modelName}UncheckedUpdateInput.schema`),
                ];
                await (0, writeFileSafely_1.writeFileSafely)(path_1.default.join(Transformer.getSchemasPath(), `${upsertOne}.schema.ts`), `${this.generateImportStatements(imports)}${this.generateExportSchemaStatement(`${modelName}Upsert`, `z.object({ ${selectZodSchemaLine} ${includeZodSchemaLine} where: ${modelName}WhereUniqueInputObjectSchema, create: z.union([ ${modelName}CreateInputObjectSchema, ${modelName}UncheckedCreateInputObjectSchema ]), update: z.union([ ${modelName}UpdateInputObjectSchema, ${modelName}UncheckedUpdateInputObjectSchema ])  })`)}`);
            }
            if (aggregate) {
                const imports = [
                    orderByImport,
                    this.generateImportStatement(`${modelName}WhereInputObjectSchema`, `./objects/${modelName}WhereInput.schema`),
                    this.generateImportStatement(`${modelName}WhereUniqueInputObjectSchema`, `./objects/${modelName}WhereUniqueInput.schema`),
                ];
                const aggregateOperations = [];
                if (this.aggregateOperationSupport[modelName].count) {
                    imports.push(this.generateImportStatement(`${modelName}CountAggregateInputObjectSchema`, `./objects/${modelName}CountAggregateInput.schema`));
                    aggregateOperations.push(`_count: z.union([ z.literal(true), ${modelName}CountAggregateInputObjectSchema ]).optional()`);
                }
                if (this.aggregateOperationSupport[modelName].min) {
                    imports.push(this.generateImportStatement(`${modelName}MinAggregateInputObjectSchema`, `./objects/${modelName}MinAggregateInput.schema`));
                    aggregateOperations.push(`_min: ${modelName}MinAggregateInputObjectSchema.optional()`);
                }
                if (this.aggregateOperationSupport[modelName].max) {
                    imports.push(this.generateImportStatement(`${modelName}MaxAggregateInputObjectSchema`, `./objects/${modelName}MaxAggregateInput.schema`));
                    aggregateOperations.push(`_max: ${modelName}MaxAggregateInputObjectSchema.optional()`);
                }
                if (this.aggregateOperationSupport[modelName].avg) {
                    imports.push(this.generateImportStatement(`${modelName}AvgAggregateInputObjectSchema`, `./objects/${modelName}AvgAggregateInput.schema`));
                    aggregateOperations.push(`_avg: ${modelName}AvgAggregateInputObjectSchema.optional()`);
                }
                if (this.aggregateOperationSupport[modelName].sum) {
                    imports.push(this.generateImportStatement(`${modelName}SumAggregateInputObjectSchema`, `./objects/${modelName}SumAggregateInput.schema`));
                    aggregateOperations.push(`_sum: ${modelName}SumAggregateInputObjectSchema.optional()`);
                }
                await (0, writeFileSafely_1.writeFileSafely)(path_1.default.join(Transformer.getSchemasPath(), `${aggregate}.schema.ts`), `${this.generateImportStatements(imports)}${this.generateExportSchemaStatement(`${modelName}Aggregate`, `z.object({ ${orderByZodSchemaLine} where: ${modelName}WhereInputObjectSchema.optional(), cursor: ${modelName}WhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), ${aggregateOperations.join(', ')} })`)}`);
            }
            if (groupBy) {
                const imports = [
                    this.generateImportStatement(`${modelName}WhereInputObjectSchema`, `./objects/${modelName}WhereInput.schema`),
                    this.generateImportStatement(`${modelName}OrderByWithAggregationInputObjectSchema`, `./objects/${modelName}OrderByWithAggregationInput.schema`),
                    this.generateImportStatement(`${modelName}ScalarWhereWithAggregatesInputObjectSchema`, `./objects/${modelName}ScalarWhereWithAggregatesInput.schema`),
                    this.generateImportStatement(`${modelName}ScalarFieldEnumSchema`, `./enums/${modelName}ScalarFieldEnum.schema`),
                ];
                await (0, writeFileSafely_1.writeFileSafely)(path_1.default.join(Transformer.getSchemasPath(), `${groupBy}.schema.ts`), `${this.generateImportStatements(imports)}${this.generateExportSchemaStatement(`${modelName}GroupBy`, `z.object({ where: ${modelName}WhereInputObjectSchema.optional(), orderBy: z.union([${modelName}OrderByWithAggregationInputObjectSchema, ${modelName}OrderByWithAggregationInputObjectSchema.array()]).optional(), having: ${modelName}ScalarWhereWithAggregatesInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), by: z.array(${modelName}ScalarFieldEnumSchema)  })`)}`);
            }
        }
    }
    generateImportStatements(imports) {
        var _a;
        let generatedImports = this.generateImportZodStatement();
        generatedImports +=
            (_a = imports === null || imports === void 0 ? void 0 : imports.filter((importItem) => !!importItem).join(';\r\n')) !== null && _a !== void 0 ? _a : '';
        generatedImports += '\n\n';
        return generatedImports;
    }
    resolveSelectIncludeImportAndZodSchemaLine(model) {
        const { name: modelName } = model;
        const hasRelationToAnotherModel = (0, helpers_1.checkModelHasModelRelation)(model);
        const selectImport = Transformer.isGenerateSelect
            ? this.generateImportStatement(`${modelName}SelectObjectSchema`, `./objects/${modelName}Select.schema`)
            : '';
        const includeImport = Transformer.isGenerateInclude && hasRelationToAnotherModel
            ? this.generateImportStatement(`${modelName}IncludeObjectSchema`, `./objects/${modelName}Include.schema`)
            : '';
        let selectZodSchemaLine = '';
        let includeZodSchemaLine = '';
        let selectZodSchemaLineLazy = '';
        let includeZodSchemaLineLazy = '';
        if (Transformer.isGenerateSelect) {
            const zodSelectObjectSchema = `${modelName}SelectObjectSchema.optional()`;
            selectZodSchemaLine = `select: ${zodSelectObjectSchema},`;
            selectZodSchemaLineLazy = `select: z.lazy((): z.ZodTypeAny => ${zodSelectObjectSchema}),`;
        }
        if (Transformer.isGenerateInclude && hasRelationToAnotherModel) {
            const zodIncludeObjectSchema = `${modelName}IncludeObjectSchema.optional()`;
            includeZodSchemaLine = `include: ${zodIncludeObjectSchema},`;
            includeZodSchemaLineLazy = `include: z.lazy((): z.ZodTypeAny => ${zodIncludeObjectSchema}),`;
        }
        return {
            selectImport,
            includeImport,
            selectZodSchemaLine,
            includeZodSchemaLine,
            selectZodSchemaLineLazy,
            includeZodSchemaLineLazy,
        };
    }
    resolveOrderByWithRelationImportAndZodSchemaLine(model) {
        var _a;
        const { name: modelName } = model;
        let modelOrderBy = '';
        if (['postgresql', 'mysql'].includes(Transformer.provider) &&
            ((_a = Transformer.previewFeatures) === null || _a === void 0 ? void 0 : _a.includes('fullTextSearch'))) {
            modelOrderBy = `${modelName}OrderByWithRelationAndSearchRelevanceInput`;
        }
        else {
            modelOrderBy = `${modelName}OrderByWithRelationInput`;
        }
        const orderByImport = this.generateImportStatement(`${modelOrderBy}ObjectSchema`, `./objects/${modelOrderBy}.schema`);
        const orderByZodSchemaLine = `orderBy: z.union([${modelOrderBy}ObjectSchema, ${modelOrderBy}ObjectSchema.array()]).optional(),`;
        return { orderByImport, orderByZodSchemaLine };
    }
}
Transformer.enumNames = [];
Transformer.rawOpsMap = {};
Transformer.outputPath = './generated';
Transformer.prismaClientOutputPath = '@prisma/client';
Transformer.isCustomPrismaClientOutputPath = false;
Transformer.prismaClientProvider = 'prisma-client-js';
Transformer.prismaClientConfig = {};
Transformer.isGenerateSelect = false;
Transformer.isGenerateInclude = false;
exports.default = Transformer;
//# sourceMappingURL=transformer.js.map