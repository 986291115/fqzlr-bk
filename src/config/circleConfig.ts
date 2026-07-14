/**
 * 朋友圈（Friends Circle）配置
 */

export interface CircleConfig {
  /** 每页显示的文章数量 */
  pageSize: number;
  /** 缓存时间（毫秒） */
  cacheTime: number;
}

export const circleConfig: CircleConfig = {
  pageSize: 20,
  cacheTime: 5 * 60 * 1000,
};
