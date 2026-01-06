'use client';

import React, { useState, useEffect } from 'react';

interface Author {
  id?: number;
  name?: string;
  avatar_url?: string;
}

interface Comment {
  id: number;
  body_text?: string;
  author?: Author;
  created_at?: string;
  is_liked?: boolean;
  user_likes_count?: number;
}

interface CommentsSectionProps {
  postId: number;
  onCommentCountChange?: (count: number) => void;
}

export function CommentsSection({ postId, onCommentCountChange }: CommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadComments() {
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/circle/posts/${postId}/comments?per_page=50&sort=oldest`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch comments');
      }

      const data = await response.json();
      setComments(data.records || []);
      onCommentCountChange?.(data.count || data.records?.length || 0);
    } catch (err) {
      console.error('[Comments] Error loading:', err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadComments();
  }, [postId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const response = await fetch(`/api/circle/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comment: {
            body: newComment,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create comment');
      }

      const comment = await response.json();
      setComments(prev => [...prev, comment]);
      setNewComment('');
      onCommentCountChange?.((comments.length || 0) + 1);
    } catch (err) {
      console.error('[Comments] Error creating:', err);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="p-4 bg-gray-50">
      {/* Comments list */}
      <div className="space-y-3 mb-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
        ) : comments.length === 0 ? (
          <p className="text-gray-500 text-center py-4 text-sm">
            No hay comentarios. Se el primero!
          </p>
        ) : (
          comments.map(comment => (
            <CommentItem key={comment.id} comment={comment} />
          ))
        )}
      </div>

      {/* New comment form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          placeholder="Escribe un comentario..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={!newComment.trim() || isSubmitting}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? '...' : 'Enviar'}
        </button>
      </form>
    </div>
  );
}

function CommentItem({ comment }: { comment: Comment }) {
  const [isLiked, setIsLiked] = useState(comment.is_liked || false);
  const [likesCount, setLikesCount] = useState(comment.user_likes_count || 0);

  async function handleLike() {
    try {
      if (isLiked) {
        await fetch(`/api/circle/comments/${comment.id}/like`, { method: 'DELETE' });
        setIsLiked(false);
        setLikesCount(prev => Math.max(0, prev - 1));
      } else {
        await fetch(`/api/circle/comments/${comment.id}/like`, { method: 'POST' });
        setIsLiked(true);
        setLikesCount(prev => prev + 1);
      }
    } catch (err) {
      console.error('Error toggling comment like:', err);
    }
  }

  function formatDate(dateString?: string) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="bg-white rounded-lg p-3 shadow-sm">
      <div className="flex items-start gap-3">
        {comment.author?.avatar_url ? (
          <img
            src={comment.author.avatar_url}
            alt={comment.author.name}
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm font-semibold">
            {comment.author?.name?.charAt(0) || '?'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm text-gray-800">
              {comment.author?.name || 'Usuario'}
            </span>
            <span className="text-xs text-gray-400">
              {formatDate(comment.created_at)}
            </span>
          </div>
          <div className="text-gray-700 text-sm">
            <p>{comment.body_text}</p>
          </div>
          <button
            onClick={handleLike}
            className={`mt-2 flex items-center gap-1 text-xs ${
              isLiked ? 'text-red-500' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <span>{isLiked ? '❤️' : '🤍'}</span>
            {likesCount > 0 && <span>{likesCount}</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
