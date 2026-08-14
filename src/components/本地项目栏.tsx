import { useEffect, useRef, useState } from 'react';
import {
  Copy,
  DownloadSimple,
  FileArrowUp,
  FloppyDisk,
  FolderOpen,
  Plus,
  Trash,
} from '@phosphor-icons/react';
import type { LocalReportingProject } from '../../shared/本地项目模型';

interface LocalProjectBarProps {
  projects: LocalReportingProject[];
  currentProjectId: string;
  autosaveStatus: string;
  notice: string;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onRename: (name: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onDeleteAll: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
}

export function LocalProjectBar({
  projects,
  currentProjectId,
  autosaveStatus,
  notice,
  onOpen,
  onCreate,
  onRename,
  onDuplicate,
  onDelete,
  onDeleteAll,
  onExport,
  onImport,
}: LocalProjectBarProps) {
  const current = projects.find((project) => project.id === currentProjectId);
  const [name, setName] = useState(current?.name || '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingDeleteAll, setConfirmingDeleteAll] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(current?.name || '');
    setConfirmingDelete(false);
    setConfirmingDeleteAll(false);
  }, [current?.id, current?.name]);

  return (
    <section className="project-bar" aria-label="本地项目管理">
      <div className="project-bar__identity">
        <span><FolderOpen weight="duotone" /></span>
        <div>
          <b>本地项目</b>
          <small>无需账号；内容只保存在当前设备的这个浏览器中，请定期导出备份。</small>
        </div>
      </div>

      <div className="project-bar__picker">
        <label>
          <span className="visually-hidden">打开项目</span>
          <select
            aria-label="打开项目"
            value={currentProjectId}
            onChange={(event) => onOpen(event.target.value)}
          >
            {projects.map((project) => (
              <option value={project.id} key={project.id}>{project.name}</option>
            ))}
          </select>
        </label>
        <label className="project-name-editor">
          <span className="visually-hidden">项目名称</span>
          <input
            aria-label="项目名称"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && name.trim()) onRename(name);
            }}
          />
          <button
            type="button"
            aria-label="保存名称"
            title="保存名称"
            disabled={!name.trim() || name.trim() === current?.name}
            onClick={() => onRename(name)}
          >
            <FloppyDisk />
          </button>
        </label>
      </div>

      <div className="project-bar__actions">
        <button type="button" onClick={onCreate}><Plus />新建项目</button>
        <button type="button" disabled={!current} onClick={onDuplicate}><Copy />复制</button>
        <button type="button" onClick={onExport}><DownloadSimple />导出</button>
        <button type="button" onClick={() => importRef.current?.click()}><FileArrowUp />导入</button>
        <input
          ref={importRef}
          className="visually-hidden"
          type="file"
          accept="application/json,.json"
          aria-label="导入项目文件"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onImport(file);
            event.target.value = '';
          }}
        />
        {confirmingDelete ? (
          <span className="project-delete-confirm">
            <button type="button" onClick={onDelete}>确认删除</button>
            <button type="button" onClick={() => setConfirmingDelete(false)}>取消</button>
          </span>
        ) : (
          <button type="button" disabled={!current} onClick={() => setConfirmingDelete(true)}>
            <Trash />删除项目
          </button>
        )}
        {confirmingDeleteAll ? (
          <span className="project-delete-confirm project-delete-confirm--all">
            <button type="button" onClick={onDeleteAll}>确认清空全部</button>
            <button type="button" onClick={() => setConfirmingDeleteAll(false)}>取消</button>
          </span>
        ) : (
          <button type="button" disabled={!projects.length} onClick={() => setConfirmingDeleteAll(true)}>
            <Trash />清空全部本机项目
          </button>
        )}
      </div>

      <div className="project-bar__status" aria-live="polite">
        <span>{autosaveStatus}</span>
        {current ? <time dateTime={current.updatedAt}>最近修改 {new Date(current.updatedAt).toLocaleString('zh-CN')}</time> : null}
        {notice ? <b>{notice}</b> : null}
      </div>
    </section>
  );
}
