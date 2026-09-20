// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Header } from './Header';

afterEach(cleanup);

describe('Header', () => {
  it('面向用户说明两项工作，不展示版本和执行模式术语', () => {
    render(<Header reportingMode="course" />);
    expect(screen.getByText('采访准备 · 新闻编辑')).toBeTruthy();
    expect(screen.queryByText(/Beta|执行模式/u)).toBeNull();
  });
});
