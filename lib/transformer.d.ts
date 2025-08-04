import type { ConnectorType, DMMF as PrismaDMMF } from '@prisma/generator-helper';
import { AggregateOperationSupport, TransformerParams } from './types';
export default class Transformer {
    name: string;
    fields: PrismaDMMF.SchemaArg[];
    schemaImports: Set<string>;
    models: PrismaDMMF.Model[];
    modelOperations: PrismaDMMF.ModelMapping[];
    aggregateOperationSupport: AggregateOperationSupport;
    enumTypes: PrismaDMMF.SchemaEnum[];
    static enumNames: string[];
    static rawOpsMap: {
        [name: string]: string;
    };
    static provider: ConnectorType;
    static previewFeatures: string[] | undefined;
    private static outputPath;
    private hasJson;
    private static prismaClientOutputPath;
    private static isCustomPrismaClientOutputPath;
    private static prismaClientProvider;
    private static prismaClientConfig;
    private static isGenerateSelect;
    private static isGenerateInclude;
    constructor(params: TransformerParams);
    static setOutputPath(outPath: string): void;
    static setIsGenerateSelect(isGenerateSelect: boolean): void;
    static setIsGenerateInclude(isGenerateInclude: boolean): void;
    static getOutputPath(): string;
    static setPrismaClientOutputPath(prismaClientCustomPath: string): void;
    static setPrismaClientProvider(provider: string): void;
    static setPrismaClientConfig(config: Record<string, unknown>): void;
    static getPrismaClientProvider(): string;
    static getPrismaClientConfig(): Record<string, unknown>;
    /**
     * Determines the schemas directory path based on the output path.
     * If the output path already ends with 'schemas', use it directly.
     * Otherwise, append 'schemas' to the output path.
     */
    private static getSchemasPath;
    static generateIndex(): Promise<void>;
    generateEnumSchemas(): Promise<void>;
    generateImportZodStatement(): string;
    generateExportSchemaStatement(name: string, schema: string): string;
    generateObjectSchema(): Promise<void>;
    generateObjectSchemaFields(): string[];
    generateObjectSchemaField(field: PrismaDMMF.SchemaArg): [string, PrismaDMMF.SchemaArg, boolean][];
    wrapWithZodValidators(mainValidator: string, field: PrismaDMMF.SchemaArg, inputType: PrismaDMMF.SchemaArg['inputTypes'][0]): string;
    addSchemaImport(name: string): void;
    generatePrismaStringLine(field: PrismaDMMF.SchemaArg, inputType: PrismaDMMF.SchemaArg['inputTypes'][0], inputsLength: number): string;
    generateFieldValidators(zodStringWithMainType: string, field: PrismaDMMF.SchemaArg): string;
    prepareObjectSchema(zodObjectSchemaFields: string[]): string;
    generateExportObjectSchemaStatement(schema: string): string;
    private isPrismaTypeAvailable;
    private hasComplexRelations;
    addFinalWrappers({ zodStringFields }: {
        zodStringFields: string[];
    }): string;
    generateImportPrismaStatement(): string;
    generateJsonSchemaImplementation(): string;
    generateObjectSchemaImportStatements(): string;
    /**
     * Get the file extension to use for imports based on Prisma client configuration
     * For ESM with importFileExtension = "js", we need to add .js extension
     */
    private getImportFileExtension;
    /**
     * Generate an import statement with the correct file extension for ESM support
     */
    private generateImportStatement;
    generateSchemaImports(): string;
    checkIsModelQueryType(type: string): {
        isModelQueryType: boolean;
        modelName: string;
        queryName: string;
    } | {
        isModelQueryType: boolean;
        modelName?: undefined;
        queryName?: undefined;
    };
    resolveModelQuerySchemaName(modelName: string, queryName: string): string;
    wrapWithZodUnion(zodStringFields: string[]): string;
    wrapWithZodObject(zodStringFields: string | string[]): string;
    resolveObjectSchemaName(): string;
    generateModelSchemas(): Promise<void>;
    generateImportStatements(imports: (string | undefined)[]): string;
    resolveSelectIncludeImportAndZodSchemaLine(model: PrismaDMMF.Model): {
        selectImport: string;
        includeImport: string;
        selectZodSchemaLine: string;
        includeZodSchemaLine: string;
        selectZodSchemaLineLazy: string;
        includeZodSchemaLineLazy: string;
    };
    resolveOrderByWithRelationImportAndZodSchemaLine(model: PrismaDMMF.Model): {
        orderByImport: string;
        orderByZodSchemaLine: string;
    };
}
