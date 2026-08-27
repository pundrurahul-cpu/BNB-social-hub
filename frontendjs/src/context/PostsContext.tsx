import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { Platform } from '../types';
import { supabase } from '../lib/supabase';

export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';

export interface Post {
  id: string;
  content: string;
  platforms: Platform[];
  status: PostStatus;
  date: Date;
  mediaUrl?: string | null;
  file?: File | null;

  // Strategic Engine Specialist Fields
  is_placeholder: boolean;
  funnel_stage?: string;
  topic?: string;
  copy_direction?: string;
  visual_idea?: string;
  post_type?: string;
  strategic_goal?: string;
  post_no?: number;
  referral_image_url?: string;

  metadata?: any;
  client_id?: string;
}

interface PostsContextType {
  posts: Post[];
  addPost: (post: any) => Promise<void>;
  deletePost: (id: string, platforms?: string[]) => Promise<void>;
  refreshPosts: () => Promise<void>;
}

const API_URL = 'http://backendjs.test/api';

const PostsContext = createContext<PostsContextType | undefined>(undefined);

import { useClient } from './ClientContext';

export function PostsProvider({ children }: { children: ReactNode }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const { activeClient } = useClient();

  const refreshPosts = useCallback(async () => {
    try {
      console.log('🔄 [Posts] Refreshing UNIFIED post list...');
      // Remove the client_id filter to show ALL posts in the single agency view
      const response = await fetch(`${API_URL}/posts`);
      if (!response.ok) throw new Error('Failed to fetch posts');
      const data = await response.json();

      const formattedPosts = data.map((p: any) => {
        let postDate = new Date();
        const rawDate = p.scheduled_at || p.created_at;
        if (rawDate) {
          const parsed = new Date(rawDate);
          if (!isNaN(parsed.getTime())) postDate = parsed;
        }

        return {
          id: p.id,
          content: p.content || '',
          platforms: p.platforms || [],
          status: p.status,
          date: postDate,
          mediaUrl: p.media_url,

          // Map All Expert Components from V1000.11
          is_placeholder: p.is_placeholder || false,
          funnel_stage: p.funnel_stage,
          topic: p.topic,
          copy_direction: p.copy_direction,
          visual_idea: p.visual_idea,
          post_type: p.post_type,
          strategic_goal: p.strategic_goal,
          post_no: p.post_no,
          referral_image_url: p.referral_image_url,

          metadata: p.metadata,
          client_id: p.client_id
        };
      });

      setPosts(formattedPosts);
    } catch (error) {
      console.error('Error fetching posts:', error);
    }
  }, []);

  useEffect(() => {
    refreshPosts();
    // Simplified: Listen to all post changes globally
    const channel = supabase
      .channel('global-db-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'posts'
      }, () => {
        console.log('🔔 [Posts] Global update received');
        refreshPosts();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshPosts]);

  const addPost = async (post: any) => {
    try {
      const formData = new FormData();
      if (post.id) formData.append('id', post.id);

      // If we have an active client, tag it, but don't fail if not
      if (activeClient?.id) {
        formData.append('client_id', String(activeClient.id));
      }
      formData.append('platforms', JSON.stringify(post.platforms || []));
      formData.append('status', post.status);

      // SAFE DATE HANDLING
      const dateVal = post.scheduled_at || post.date || new Date();
      formData.append('scheduled_at', new Date(dateVal).toISOString());
      formData.append('is_placeholder', String(post.is_placeholder || false));

      if (post.file) {
        formData.append('media', post.file);
      } else if (post.mediaUrl || post.media_url) {
        formData.append('media_url', post.mediaUrl || post.media_url);
      }

      const response = await fetch(`${API_URL}/posts`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Database error');

      await refreshPosts();
    } catch (error: any) {
      console.error('Save Error:', error.message);
      throw error;
    }
  };

  const deletePost = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/posts/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Delete failed');
      await refreshPosts();
    } catch (error) {
      console.error('Delete Error:', error);
      throw error;
    }
  };

  return (
    <PostsContext.Provider value={{ posts, addPost, deletePost, refreshPosts }}>
      {children}
    </PostsContext.Provider>
  );
}

export function usePosts() {
  const context = useContext(PostsContext);
  if (context === undefined) throw new Error('usePosts must be used within a PostsProvider');
  return context;
}
