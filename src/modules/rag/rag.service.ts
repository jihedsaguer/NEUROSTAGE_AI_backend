import {
  Injectable,
  Logger,
  BadGatewayException,
  ServiceUnavailableException,
  BadRequestException,
} from '@nestjs/common';
import { existsSync } from 'fs';
import { resolve } from 'path';

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  private get aiUrl(): string {
    return process.env.AI_SERVICE_URL ?? 'http://neurostage_ai:8001';
  }

  private get internalHeaders(): Record<string, string> {
    return {
      'X-Internal-Secret': process.env.INTERNAL_SECRET ?? '',
      'Content-Type': 'application/json',
    };
  }

  private async getFetch() {
    return (globalThis as any).fetch ?? (await import('node-fetch')).default;
  }

  async ingestDocument(
    filePath: string,
    documentName: string,
    documentType: string,
  ): Promise<{ success: boolean; chunksIndexed: number }> {
    const normalizedPath = resolve(filePath);
    if (!existsSync(normalizedPath)) {
      throw new BadRequestException(
        `File not found at path: ${filePath}. Use a path that exists on the backend runtime filesystem.`,
      );
    }

    const fetchFn = await this.getFetch();
    const url = `${this.aiUrl.replace(/\/$/, '')}/rag/documents`;

    let response: Response;
    try {
      response = await fetchFn(url, {
        method: 'POST',
        headers: this.internalHeaders,
        body: JSON.stringify({ filePath: normalizedPath, documentName, documentType }),
        // 2-minute timeout for large documents
        signal: AbortSignal.timeout ? AbortSignal.timeout(120000) : undefined,
      });
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
        throw new ServiceUnavailableException('AI service is not available');
      }
      this.logger.error(
        `RAG ingest network error for '${documentName}': ${(err as Error).message}`,
      );
      throw new BadGatewayException(
        `RAG document ingestion failed: ${(err as Error).message}`,
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(
        `RAG ingest returned ${response.status} for '${documentName}': ${body}`,
      );
      throw new BadGatewayException(
        `RAG document ingestion failed with status ${response.status}`,
      );
    }

    const data = await response.json();
    this.logger.log(
      `RAG ingested '${documentName}': ${data.chunksIndexed ?? '?'} chunks`,
    );
    return data as { success: boolean; chunksIndexed: number };
  }

  async queryRag(
    question: string,
    userId: string,
  ): Promise<{
    answer: string;
    sources: { documentName: string; excerpt: string }[];
  }> {
    const fetchFn = await this.getFetch();
    const url = `${this.aiUrl.replace(/\/$/, '')}/rag/query`;

    let response: Response;
    try {
      response = await fetchFn(url, {
        method: 'POST',
        headers: this.internalHeaders,
        body: JSON.stringify({ question, userId }),
        signal: AbortSignal.timeout ? AbortSignal.timeout(120000) : undefined,
      });
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
        throw new ServiceUnavailableException('AI service is not available');
      }
      this.logger.error(
        `RAG query network error: ${(err as Error).message}`,
      );
      throw new BadGatewayException(
        `RAG query failed: ${(err as Error).message}`,
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(`RAG query returned ${response.status}: ${body}`);
      throw new BadGatewayException(
        `RAG query failed with status ${response.status}`,
      );
    }

    return response.json() as Promise<{
      answer: string;
      sources: { documentName: string; excerpt: string }[];
    }>;
  }
}
