
export class StackMerger {
  public static readonly START_TAG =
    '// [kiro-power:start] auto-generated — do not edit manually';
  public static readonly END_TAG = '// [kiro-power:end]';

  private static readonly BLOCK_PATTERN = `${StackMerger.escapeForRegex(
    StackMerger.START_TAG
  )}[\\s\\S]*?${StackMerger.escapeForRegex(StackMerger.END_TAG)}`;

  public static merge(existingContent: string, generatedSnippet: string): string {
    const wrappedBlock = this.wrapWithTags(generatedSnippet);

    if (this.hasExistingBlock(existingContent)) {
      return this.replaceExistingBlock(existingContent, wrappedBlock);
    }

    return this.insertAtConstructorEnd(existingContent, wrappedBlock);
  }

  private static hasExistingBlock(content: string): boolean {
    // Cria um novo RegExp a cada chamada para evitar o bug de `lastIndex`
    return new RegExp(this.BLOCK_PATTERN).test(content);
  }

  private static replaceExistingBlock(content: string, newBlock: string): string {
    // Cria um novo RegExp separado do usado no test() — evita o bug de lastIndex
    return content.replace(new RegExp(this.BLOCK_PATTERN), newBlock);
  }

  private static insertAtConstructorEnd(content: string, block: string): string {
    // Procura o fechamento do construtor da Stack CDK (última ocorrência de '  }')
    const insertionIndex = content.lastIndexOf('  }');

    if (insertionIndex === -1) {
      // Fallback seguro: acrescenta ao final do arquivo
      return `${content}\n\n    ${block}\n`;
    }

    return (
      content.substring(0, insertionIndex) +
      `\n    ${block}\n` +
      content.substring(insertionIndex)
    );
  }

  private static wrapWithTags(snippet: string): string {
    return `${this.START_TAG}\n${snippet}\n    ${this.END_TAG}`;
  }

  private static escapeForRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
