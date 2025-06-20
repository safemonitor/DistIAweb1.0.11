import { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  Download, 
  Trash2, 
  BarChart3, 
  PieChart, 
  LineChart, 
  Table as TableIcon,
  RefreshCw,
  Info,
  AlertCircle,
  Zap,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Code
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

// Token usage interface
interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

// Message types
interface Message {
  role: 'user' | 'assistant';
  content: string;
  data?: any;
  query_description?: string;
  raw_sql_query?: string;
  usage?: TokenUsage;
}

// Chart configuration types
interface ChartConfig {
  type: 'bar' | 'line' | 'pie';
  data: any;
  options: any;
  noDataMessage?: string;
}

// Pending chart request interface
interface PendingChartRequest {
  data: any[];
  messageIndex: number;
}

export function ChatbotPage() {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hello! I\'m your DistrIA assistant. I can help you analyze your data, generate reports, and answer questions about your business. What would you like to know?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [chartConfigs, setChartConfigs] = useState<Record<number, ChartConfig>>({});
  const [pendingChartRequest, setPendingChartRequest] = useState<PendingChartRequest | null>(null);
  const [expandedTechnicalDetails, setExpandedTechnicalDetails] = useState<Record<number, boolean>>({});

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage = input.trim();
    setInput('');
    setError(null);
    
    // Add user message to chat
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    
    setIsLoading(true);
    
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      // Call the Edge Function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chatbot-api`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ message: userMessage })
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.content || 'Failed to get response from chatbot');
      }
      
      const responseData = await response.json();
      
      if (responseData.type === 'data') {
        // First, add the natural language summary message
        setMessages(prev => [
          ...prev, 
          { 
            role: 'assistant', 
            content: responseData.content,
            query_description: responseData.query_description,
            raw_sql_query: responseData.raw_sql_query,
            usage: responseData.usage
          }
        ]);
        
        // Then, add a second message asking if the user wants to see a chart
        setMessages(prev => {
          const newMessages = [
            ...prev,
            {
              role: 'assistant',
              content: 'I have retrieved the data. Would you like to see a chart for this information?',
              data: responseData.data
            }
          ];
          
          // Set the pending chart request
          setPendingChartRequest({
            data: responseData.data,
            messageIndex: newMessages.length - 1
          });
          
          return newMessages;
        });
      } else {
        // For text-only responses, just add the message
        setMessages(prev => [
          ...prev, 
          { 
            role: 'assistant', 
            content: responseData.content,
            usage: responseData.usage
          }
        ]);
      }
      
    } catch (err) {
      console.error('Error sending message:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleChartConfirmation = (confirmed: boolean) => {
    if (!pendingChartRequest) return;
    
    if (confirmed) {
      // Generate chart for the specified message
      generateChartConfig(pendingChartRequest.data, pendingChartRequest.messageIndex);
    }
    
    // Clear the pending request
    setPendingChartRequest(null);
  };

  const generateChartConfig = (data: any[], messageIndex: number) => {
    // Check if data is valid for charting
    if (!data || data.length === 0) {
      setChartConfigs(prev => ({
        ...prev,
        [messageIndex]: {
          type: 'bar',
          data: {},
          options: {},
          noDataMessage: 'No data available to generate a chart.'
        }
      }));
      return;
    }
    
    try {
      // Determine if data is suitable for charting
      const firstItem = data[0];
      
      // Check if firstItem is a valid object
      if (!firstItem || typeof firstItem !== 'object') {
        setChartConfigs(prev => ({
          ...prev,
          [messageIndex]: {
            type: 'bar',
            data: {},
            options: {},
            noDataMessage: 'The data format is not suitable for charting.'
          }
        }));
        return;
      }
      
      const keys = Object.keys(firstItem);
      
      // Need at least 2 fields for a chart (typically a label and a value)
      if (keys.length < 2) {
        setChartConfigs(prev => ({
          ...prev,
          [messageIndex]: {
            type: 'bar',
            data: {},
            options: {},
            noDataMessage: 'The data needs at least two fields to generate a chart.'
          }
        }));
        return;
      }
      
      // Try to identify numeric fields for values
      const numericFields = keys.filter(key => 
        typeof firstItem[key] === 'number' || 
        !isNaN(parseFloat(firstItem[key]))
      );
      
      // Try to identify string/date fields for labels
      const labelFields = keys.filter(key => 
        typeof firstItem[key] === 'string' || 
        firstItem[key] instanceof Date
      );
      
      if (numericFields.length === 0 || labelFields.length === 0) {
        setChartConfigs(prev => ({
          ...prev,
          [messageIndex]: {
            type: 'bar',
            data: {},
            options: {},
            noDataMessage: 'The data needs both numeric and text fields to generate a chart.'
          }
        }));
        return;
      }
      
      // Choose first string field as label and first numeric field as value
      const labelField = labelFields[0];
      const valueField = numericFields[0];
      
      // Extract labels and values
      const labels = data.map(item => item[labelField]);
      const values = data.map(item => 
        typeof item[valueField] === 'number' 
          ? item[valueField] 
          : parseFloat(item[valueField])
      );
      
      // Determine best chart type based on data
      let chartType: 'bar' | 'line' | 'pie' = 'bar';
      
      // If we have time-series data (dates in order), use line chart
      if (labels.every(label => !isNaN(Date.parse(String(label))))) {
        chartType = 'line';
      }
      // If we have few categories (<=5), use pie chart
      else if (labels.length <= 5) {
        chartType = 'pie';
      }
      // Otherwise use bar chart
      
      // Generate random colors
      const backgroundColors = labels.map(() => 
        `rgba(${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)}, 0.2)`
      );
      
      const borderColors = backgroundColors.map(color => 
        color.replace('0.2', '1')
      );
      
      // Create chart config
      const config: ChartConfig = {
        type: chartType,
        data: {
          labels,
          datasets: [{
            label: valueField,
            data: values,
            backgroundColor: backgroundColors,
            borderColor: borderColors,
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top' as const,
            },
            title: {
              display: true,
              text: `${labelField} vs ${valueField}`
            }
          }
        }
      };
      
      setChartConfigs(prev => ({
        ...prev,
        [messageIndex]: config
      }));
      
    } catch (err) {
      console.error('Error generating chart:', err);
      setChartConfigs(prev => ({
        ...prev,
        [messageIndex]: {
          type: 'bar',
          data: {},
          options: {},
          noDataMessage: 'An error occurred while generating the chart.'
        }
      }));
    }
  };

  const downloadChatHistory = () => {
    const chatText = messages.map(msg => 
      `${msg.role === 'user' ? 'You' : 'Assistant'}: ${msg.content}`
    ).join('\n\n');
    
    const blob = new Blob([chatText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-history-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearChat = () => {
    if (confirm('Are you sure you want to clear the chat history?')) {
      setMessages([{
        role: 'assistant',
        content: 'Chat history cleared. How can I help you today?'
      }]);
      setChartConfigs({});
      setPendingChartRequest(null);
      setExpandedTechnicalDetails({});
    }
  };

  const toggleTechnicalDetails = (index: number) => {
    setExpandedTechnicalDetails(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const renderDataTable = (data: any[]) => {
    if (!data || data.length === 0) return null;
    
    const columns = Object.keys(data[0]);
    
    return (
      <div className="overflow-x-auto mt-4 border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column, i) => (
                <th 
                  key={i}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                {columns.map((column, j) => (
                  <td key={j} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {row[column] !== null && row[column] !== undefined ? String(row[column]) : 'N/A'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderChart = (config: ChartConfig) => {
    // If there's a no data message, display it instead of attempting to render a chart
    if (config.noDataMessage) {
      return (
        <div className="flex items-center justify-center h-[300px] bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-center p-6">
            <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600">{config.noDataMessage}</p>
          </div>
        </div>
      );
    }
    
    const { type, data, options } = config;
    const chartHeight = 300;
    
    switch (type) {
      case 'bar':
        return <Bar data={data} options={options} height={chartHeight} />;
      case 'line':
        return <Line data={data} options={options} height={chartHeight} />;
      case 'pie':
        return <Pie data={data} options={options} height={chartHeight} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-200px)]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
          <Bot className="h-6 w-6 mr-2 text-indigo-600" />
          DistrIA Assistant
        </h1>
        <div className="flex space-x-2">
          <button
            onClick={downloadChatHistory}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
            disabled={messages.length <= 1}
          >
            <Download className="h-4 w-4 mr-2" />
            Download Chat
          </button>
          <button
            onClick={clearChat}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700"
            disabled={messages.length <= 1}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Chat
          </button>
        </div>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto bg-gray-50 rounded-lg p-4 mb-4">
        {messages.map((message, index) => (
          <div key={index} className={`mb-4 ${message.role === 'user' ? 'text-right' : ''}`}>
            <div className={`inline-block max-w-3xl rounded-lg p-4 ${
              message.role === 'user' 
                ? 'bg-indigo-100 text-left' 
                : 'bg-white shadow-sm border border-gray-200'
            }`}>
              <div className="flex items-start">
                <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                  message.role === 'user' ? 'bg-indigo-500' : 'bg-gray-200'
                }`}>
                  {message.role === 'user' 
                    ? <User className="h-4 w-4 text-white" /> 
                    : <Bot className="h-4 w-4 text-gray-600" />
                  }
                </div>
                <div className="ml-3 text-sm">
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  
                  {/* Display token usage for assistant messages */}
                  {message.role === 'assistant' && message.usage && (
                    <div className="mt-2 text-xs text-gray-400 flex items-center">
                      <Zap className="h-3 w-3 mr-1" />
                      <span>
                        Tokens: {message.usage.prompt_tokens} prompt + {message.usage.completion_tokens} completion = {message.usage.total_tokens} total
                      </span>
                    </div>
                  )}
                  
                  {/* Display technical details in a collapsible section */}
                  {message.role === 'assistant' && (message.query_description || message.raw_sql_query) && (
                    <div className="mt-4 border border-gray-200 rounded-md">
                      <button 
                        onClick={() => toggleTechnicalDetails(index)}
                        className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-t-md"
                      >
                        <div className="flex items-center">
                          <Code className="h-3 w-3 mr-1" />
                          <span>Technical Details</span>
                        </div>
                        {expandedTechnicalDetails[index] ? (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-500" />
                        )}
                      </button>
                      
                      {expandedTechnicalDetails[index] && (
                        <div className="p-4 bg-gray-50 border-t border-gray-200 text-xs">
                          {/* Query description */}
                          {message.query_description && (
                            <div className="mb-3">
                              <div className="font-medium text-gray-700 mb-1">Query Description:</div>
                              <div className="text-gray-600">{message.query_description}</div>
                            </div>
                          )}
                          
                          {/* SQL query */}
                          {message.raw_sql_query && (
                            <div>
                              <div className="font-medium text-gray-700 mb-1">SQL Query:</div>
                              <pre className="bg-gray-100 p-2 rounded overflow-x-auto text-gray-600">
                                {message.raw_sql_query}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Render data visualization if available */}
                  {message.data && (
                    <div className="mt-4">
                      {/* Data table - always render if there's data */}
                      {message.data.length > 0 && renderDataTable(message.data)}
                      
                      {/* Chart confirmation buttons */}
                      {pendingChartRequest && pendingChartRequest.messageIndex === index && (
                        <div className="mt-4 flex space-x-2">
                          <button
                            onClick={() => handleChartConfirmation(true)}
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
                          >
                            <Check className="h-4 w-4 mr-2" />
                            Yes, show chart
                          </button>
                          <button
                            onClick={() => handleChartConfirmation(false)}
                            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
                          >
                            <X className="h-4 w-4 mr-2" />
                            No, thanks
                          </button>
                        </div>
                      )}
                      
                      {/* Chart visualization - only if confirmed */}
                      {chartConfigs[index] && (
                        <div className="mt-4 h-[300px]">
                          {renderChart(chartConfigs[index])}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="mb-4">
            <div className="inline-block max-w-3xl rounded-lg p-4 bg-white shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-gray-600" />
                </div>
                <div className="ml-3">
                  <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="relative">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask me anything about your data..."
          className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 resize-none"
          rows={3}
          disabled={isLoading}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || isLoading}
          className="absolute right-3 bottom-3 inline-flex items-center justify-center p-2 rounded-full text-indigo-600 hover:bg-indigo-100 disabled:opacity-50 disabled:hover:bg-transparent"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}