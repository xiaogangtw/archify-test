import type { Browser, Page, TestInfo } from '@playwright/test';
export function setUiRole(page: Page, role: string): void;
export function setUiReady(page: Page, selector: string | null, timeoutMs?: number): void;
export function uiStep<T>(page: Page, title: string, callback: () => Promise<T>, expected?: string): Promise<T>;
export function uiWaitForResponse(page: Page, operation: string, trigger: () => Promise<unknown>, timeoutMs?: number): Promise<import('@playwright/test').Response>;
export function instrumentBrowser(browser: Browser, getInfo: () => TestInfo, step: <T>(title: string, body: () => Promise<T>) => Promise<T>): Browser;
export function instrumentExpect<T>(expect: T, getInfo: () => TestInfo, step: <R>(title: string, body: () => Promise<R>) => Promise<R>): T;
