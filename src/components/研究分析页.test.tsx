// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResearchAnalysisPanel } from './研究分析页';
import { createBrowserResearchRepository } from '../services/本地研究仓库';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('研究分析页', () => {
  it('默认只显示真实数据；没有真实场次时显示验证不足，不伪造图表', async () => {
    const repository = createBrowserResearchRepository(new MemoryStorage());
    render(<ResearchAnalysisPanel repository={repository} />);
    expect(await screen.findByText('当前尚未完成真实用户验证。')).toBeTruthy();
    expect((screen.getByRole('radio', { name: '真实数据' }) as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByText(/100%/u)).toBeNull();
  });
});
