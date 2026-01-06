'use client';

import React, { useState } from 'react';
import { CommentsSection } from './CommentsSection';

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

interface PostCardProps {
  post: Post;
}

export function PostCard({ post }: PostCardProps) {
  const [isLiked, setIsLiked] = useState(post.is_liked || false);
  const [likesCount, setLikesCount] = useState(post.user_likes_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post.comment_count || 0);

  async function handleLike() {
    try {
      if (isLiked) {
        await fetch(`/api/circle/posts/${post.id}/like`, { method: 'DELETE' });
        setIsLiked(false);
        setLikesCount(prev => Math.max(0, prev - 1));
      } else {
        await fetch(`/api/circle/posts/${post.id}/like`, { method: 'POST' });
        setIsLiked(true);
        setLikesCount(prev => prev + 1);
      }
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  }

  function formatDate(dateString?: string) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  // Simple text rendering for now (without BlockEditor to avoid SDK dependency)
  function renderContent() {
    if (post.body_plain_text) {
      return <p className="text-gray-700 whitespace-pre-wrap">{post.body_plain_text}</p>;
    }
    return null;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          {post.author?.avatar_url ? (
            <img
              src={post.author.avatar_url}
              alt={post.author.name}
              className="w-10 h-10 rounded-full"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold">
              {post.author?.name?.charAt(0) || '?'}
            </div>
          )}
          <div>
            <p className="font-semibold text-gray-800">{post.author?.name || 'Usuario'}</p>
            <p className="text-sm text-gray-500">{formatDate(post.created_at)}</p>
          </div>
        </div>
      </div>

      {/* Title */}
      {post.name && (
        <div className="px-4 pt-4">
          <h3 className="text-lg font-bold text-gray-800">{post.name}</h3>
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {renderContent()}
      </div>

      {/* Cover image */}
      {post.cover_image && (
        <div className="px-4 pb-4">
          <img
            src={post.cover_image}
            alt=""
            className="w-full rounded-lg"
          />
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-4">
        <button
          onClick={handleLike}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
            isLiked
              ? 'bg-red-50 text-red-600'
              : 'hover:bg-gray-100 text-gray-600'
          }`}
        >
          <span>{isLiked ? '❤️' : '🤍'}</span>
          <span className="text-sm">{likesCount}</span>
        </button>

        <button
          onClick={() => setShowComments(!showComments)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
            showComments
              ? 'bg-indigo-50 text-indigo-600'
              : 'hover:bg-gray-100 text-gray-600'
          }`}
        >
          <span>💬</span>
          <span className="text-sm">{commentsCount}</span>
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="border-t border-gray-100">
          <CommentsSection
            postId={post.id}
            onCommentCountChange={setCommentsCount}
          />
        </div>
      )}
    </div>
  );
}
