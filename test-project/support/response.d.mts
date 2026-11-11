import type { APIResponse, TestInfo } from '@playwright/test';
export function redactResponse(value: unknown): unknown;
export function showResponse(response: APIResponse, testInfo: TestInfo): Promise<void>;
