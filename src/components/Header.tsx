import { NewspaperClipping } from '@phosphor-icons/react';
import type { ReportingMode } from '../types';

interface HeaderProps {
  reportingMode: ReportingMode;
}

export function Header({ reportingMode }: HeaderProps) {
  return (
    <header className="np-header">
      <a className="np-brand" href="#top" aria-label="返回 NewsPilot 首页">
        <span className="np-brand__mark" aria-hidden="true">
          <NewspaperClipping weight="fill" />
        </span>
        <span>
          <strong>NewsPilot</strong>
          <small>学生记者报道工作台</small>
        </span>
      </a>
      <span className="np-edition">
        v1.1 Beta · {reportingMode === 'course' ? '课程作业执行模式' : '校园媒体执行模式'}
      </span>
    </header>
  );
}
