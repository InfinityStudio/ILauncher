import type { TaskState } from '@universal/task';

/**
 * The task item represent a sub task
 */
export interface TaskItem {
    /**
     * The unique id of this task node
     */
    id: string;

    /**
     * The task root id
     */
    taskId: string;

    children: TaskItem[] | undefined;
    allChildren: TaskItem[];

    time: Date;

    title: string;
    message: string;
    total: number;
    progress: number;

    state: TaskState;
    throughput: number;

    parentId?: number;
}
