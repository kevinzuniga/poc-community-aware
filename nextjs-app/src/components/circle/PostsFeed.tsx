'use client';

import React, { useState, useEffect } from 'react';
import { PostCard } from './PostCard';
import { CreatePost } from './CreatePost';

interface Author {
  id?: number;
  name?: string;
  avatar_url?: string;
}

interface Post {
  id: number;
  name?: string;
  body_plain_text?: string;
  tiptap_body?: {
    body: any;
    sgids_to_object_map?: Record<string, unknown>;
    inline_attachments?: unknown[];
  };
  cover_image?: string;
  author?: Author;
  created_at?: string;
  is_liked?: boolean;
  user_likes_count?: number;
  comment_count?: number;
}

interface PostsFeedProps {
  spaceId: number | string;
  spaceName: string;
  allowCreate?: boolean;
}

export function PostsFeed({ spaceId, spaceName, allowCreate = true }: PostsFeedProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);

  async function loadPosts(pageNum: number = 1, append: boolean = false) {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `/api/circle/spaces/${spaceId}/posts?page=${pageNum}&per_page=10`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch posts');
      }

      const data = await response.json();

      if (append) {
        setPosts(prev => [...prev, ...(data.records || [])]);
      } else {
        setPosts(data.records || []);
      }
      setHasNextPage(data.has_next_page || false);
      setPage(pageNum);
    } catch (err: any) {
      console.error('[PostsFeed] Error loading posts:', err);
      setError('Error al cargar los posts');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadPosts(1);
  }, [spaceId]);

  function handlePostCreated(newPost: Post) {
    setPosts(prev => [newPost, ...prev]);
  }

  function handleLoadMore() {
    loadPosts(page + 1, true);
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <div className="text-4xl mb-3">⚠️</div>
        <p className="text-red-800">{error}</p>
        <button
          onClick={() => loadPosts(1)}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">{spaceName}</h2>
        {allowCreate && (
          <CreatePost spaceId={spaceId} onPostCreated={handlePostCreated} />
        )}
      </div>

      {/* Posts */}
      {isLoading && posts.length === 0 ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-lg p-6 shadow-sm animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="h-3 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-12 text-center">
          <div className="text-5xl mb-4">📝</div>
          <p className="text-gray-500">No hay posts todavia</p>
          {allowCreate && (
            <p className="text-gray-400 text-sm mt-2">Se el primero en publicar algo</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map(post => (
            <PostCard key={post.id} post={post} />
          ))}

          {/* Load more */}
          {hasNextPage && (
            <div className="text-center pt-4">
              <button
                onClick={handleLoadMore}
                disabled={isLoading}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Cargando...' : 'Cargar mas'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
