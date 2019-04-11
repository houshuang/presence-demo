declare class StringChangeDetector {

  constructor(options: {
    value: string;
    onInsert: (index: number, value: string) => void;
    onRemove: (index: number, length: number) => void;
  });

  public insertText(index, value): void;

  public removeText(index, length): void;

  public setValue(value): void;

  public getValue(): string;

  public processNewValue(newValue): void;
}

export = StringChangeDetector;
