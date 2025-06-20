import { useState, useEffect } from 'react';
import { 
  Image, 
  Plus, 
  Search, 
  Filter, 
  Pencil, 
  Trash2, 
  FileText, 
  Video, 
  Upload,
  Eye
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PromotionalContentModal } from '../components/PromotionalContentModal';
import { PromotionalContentViewerModal } from '../components/PromotionalContentViewerModal';
import type { PromotionalContent } from '../types/database';

export function PromotionalContentManagementPage() {
  const [content, setContent] = useState<PromotionalContent[]>([]);
  const [filteredContent, setFilteredContent] = useState<PromotionalContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewerModalOpen, setIsViewerModalOpen] = useState(false);
  const [selectedContent, setSelectedContent] = useState<PromotionalContent | undefined>();

  useEffect(() => {
    fetchContent();
  }, []);

  useEffect(() => {
    filterContent();
  }, [searchTerm, typeFilter, content]);

  async function fetchContent() {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('promotional_content')
        .select(`
          *,
          created_by_profile:profiles!created_by (
            first_name,
            last_name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContent(data || []);
      setFilteredContent(data || []);
    } catch (err) {
      console.error('Error fetching promotional content:', err);
      setError('Failed to load promotional content');
    } finally {
      setIsLoading(false);
    }
  }

  function filterContent() {
    let filtered = content;

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(term) ||
        item.content_text?.toLowerCase().includes(term)
      );
    }

    // Filter by type
    if (typeFilter !== 'all') {
      filtered = filtered.filter(item => item.type === typeFilter);
    }

    setFilteredContent(filtered);
  }

  const handleAddContent = () => {
    setSelectedContent(undefined);
    setIsModalOpen(true);
  };

  const handleEditContent = (content: PromotionalContent) => {
    setSelectedContent(content);
    setIsModalOpen(true);
  };

  const handleViewContent = (content: PromotionalContent) => {
    setSelectedContent(content);
    setIsViewerModalOpen(true);
  };

  const handleDeleteContent = async (content: PromotionalContent) => {
    if (!confirm(`Are you sure you want to delete "${content.name}"?`)) return;

    try {
      // Delete the content
      const { error } = await supabase
        .from('promotional_content')
        .delete()
        .eq('id', content.id);

      if (error) throw error;

      // If there's a content URL, delete the file from storage
      if (content.content_url) {
        // Extract the file path from the URL
        const urlParts = content.content_url.split('/');
        const fileName = urlParts[urlParts.length - 1];
        const filePath = `${content.id}/${fileName}`;

        const { error: storageError } = await supabase.storage
          .from('marketing-media')
          .remove([filePath]);

        if (storageError) {
          console.error('Error deleting file from storage:', storageError);
        }
      }

      await fetchContent();
    } catch (err) {
      console.error('Error deleting content:', err);
      alert('Failed to delete content');
    }
  };

  const getContentTypeIcon = (type: PromotionalContent['type']) => {
    switch (type) {
      case 'text':
        return FileText;
      case 'image':
        return Image;
      case 'video':
        return Video;
      default:
        return FileText;
    }
  };

  const getContentTypeColor = (type: PromotionalContent['type']) => {
    switch (type) {
      case 'text':
        return 'text-blue-600 bg-blue-100';
      case 'image':
        return 'text-green-600 bg-green-100';
      case 'video':
        return 'text-purple-600 bg-purple-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Promotional Content</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage text, images, and videos for your marketing campaigns
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={handleAddContent}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Content
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
              Search Content
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or content..."
                className="block w-full rounded-md border-gray-300 pl-10 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>
          <div>
            <label htmlFor="type-filter" className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Type
            </label>
            <select
              id="type-filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="all">All Types</option>
              <option value="text">Text</option>
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="bg-white shadow rounded-lg p-6">
        {filteredContent.length === 0 ? (
          <div className="text-center py-8">
            <Image className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No content found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || typeFilter !== 'all' 
                ? 'No content matches your filters.' 
                : 'Get started by creating some promotional content.'
              }
            </p>
            <div className="mt-6">
              <button
                onClick={handleAddContent}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Content
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredContent.map((item) => {
              const ContentTypeIcon = getContentTypeIcon(item.type);
              const contentTypeColor = getContentTypeColor(item.type);
              
              return (
                <div key={item.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  {item.type === 'image' && item.content_url && (
                    <div className="h-48 bg-gray-200 relative">
                      <img 
                        src={item.content_url} 
                        alt={item.name} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  
                  {item.type === 'video' && item.content_url && (
                    <div className="h-48 bg-gray-200 relative">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Video className="h-12 w-12 text-gray-400" />
                      </div>
                    </div>
                  )}
                  
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${contentTypeColor}`}>
                        <ContentTypeIcon className="h-3 w-3 mr-1" />
                        {item.type}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <h3 className="text-lg font-medium text-gray-900 mb-1">{item.name}</h3>
                    
                    {item.type === 'text' && item.content_text && (
                      <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                        {item.content_text}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between mt-2">
                      <div className="text-xs text-gray-500">
                        By {item.created_by_profile?.first_name} {item.created_by_profile?.last_name}
                      </div>
                      
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleViewContent(item)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="View Content"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEditContent(item)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Edit Content"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteContent(item)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete Content"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      <PromotionalContentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        content={selectedContent}
        onSuccess={fetchContent}
      />

      {selectedContent && (
        <PromotionalContentViewerModal
          isOpen={isViewerModalOpen}
          onClose={() => setIsViewerModalOpen(false)}
          content={selectedContent}
        />
      )}
    </div>
  );
}