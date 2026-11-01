export interface UploadedFile {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
}

/** Turns an uploaded document into plain text. */
export interface TextExtractor {
  supports(file: Pick<UploadedFile, "name" | "mimeType">): boolean;
  extract(file: UploadedFile): Promise<string>;
}
