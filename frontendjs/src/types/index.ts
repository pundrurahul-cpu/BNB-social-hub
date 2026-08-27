export type Platform = 'instagram' | 'facebook' | 'linkedin' | 'twitter' | 'pinterest' | 'telegram' | 'tiktok' | 'youtube';

export type PostStatus = 'draft' | 'pending' | 'scheduled' | 'published';

export interface Author {
  name: string;
  avatar: string;
}

export interface Post {
  id: string;
  content: string;
  platforms: Platform[];
  scheduledFor: Date;
  status: PostStatus;
  author: Author;
  media?: string[];
}

export interface Metric {
  label: string;
  value: string;
  change: number; 
  trend: 'up' | 'down';
}

export interface ChartData {
  name: string;
  instagram: number;
  facebook: number;
  linkedin: number;
  twitter: number;
  pinterest?: number;
  telegram?: number;
  tiktok?: number;
  youtube?: number;
}
