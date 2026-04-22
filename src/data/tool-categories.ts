export interface ToolCategory {
  id: string;
  name: string;
  icon: string;
  tools: Tool[];
}

export interface Tool {
  id: string;
  name: string;
  desc: string;
  path: string;
  status: 'done' | 'todo';
}

export const toolCategories: ToolCategory[] = [
  {
    id: 'lab',
    name: 'Lab',
    icon: '🧪',
    tools: [
      {
        id: 'experiments',
        name: 'Experiment Records',
        desc: 'Log and track thin-film growth parameters in a structured notebook.',
        path: '/experiments/',
        status: 'done',
      },
    ],
  },
  {
    id: 'market',
    name: 'Market',
    icon: '🥇',
    tools: [
      {
        id: 'gold',
        name: 'Gold Price',
        desc: 'Track domestic and international gold prices in one place.',
        path: '/kit/gold/',
        status: 'done',
      },
    ],
  },
];

export const allTools = toolCategories.flatMap((category) => category.tools);

export function findToolById(id: string): Tool | undefined {
  return allTools.find((tool) => tool.id === id);
}

export function findCategoryById(id: string): ToolCategory | undefined {
  return toolCategories.find((category) => category.id === id);
}
