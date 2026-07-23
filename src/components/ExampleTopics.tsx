interface ExampleTopicsProps {
  onSelect: (topic: string) => void;
  disabled?: boolean;
}

const examples = [
  { label: '校园', topic: '高校搭子社交现象调查' },
  { label: '社会', topic: '城市青年夜间消费与公共空间变化' },
  { label: '科技', topic: '生成式 AI 工具如何进入普通人的工作流程' },
  { label: '教育', topic: '高校课堂评价方式正在发生哪些变化' },
  { label: 'AI', topic: '大学生使用生成式 AI 完成课程作业' },
];

export function ExampleTopics({ onSelect, disabled = false }: ExampleTopicsProps) {
  return (
    <div className="prompt-examples" aria-labelledby="example-topics-title">
      <span id="example-topics-title">快速开始</span>
      <div className="prompt-examples__list">
        {examples.map((example) => (
          <button
            key={example.label}
            type="button"
            onClick={() => onSelect(example.topic)}
            disabled={disabled}
            title={'填入示例：' + example.topic}
            aria-label={example.label + '：填入示例主题“' + example.topic + '”'}
          >
            {example.label}
          </button>
        ))}
      </div>
    </div>
  );
}
