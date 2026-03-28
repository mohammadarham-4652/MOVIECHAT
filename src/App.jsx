import React, { useState, useEffect, useRef } from 'react';
import {
  PlusCircle,
  Explore,
  Bookmarks,
  AutoAwesome,
  Settings,
  Coffee,
  Person,
  Movie as MovieIcon,
  ArrowUpward,
  AttachFile,
  Close,
  Star,
  Menu
} from './components/Icons';
import { cn } from './lib/utils';
import { getMovieRecommendations } from './services/gemini';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';

const MoviePoster = ({ src, alt, className }) => {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [realSrc, setRealSrc] = useState(src);

  // Basic check to see if the URL looks like a direct image link
  const isLikelyImage = (url) => {
    const extensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const lowerUrl = url?.toLowerCase() || '';
    return extensions.some(ext => lowerUrl.includes(ext)) || lowerUrl.includes('image.tmdb.org') || lowerUrl.includes('media-amazon.com');
  };

  useEffect(() => {
    if (error || !isLikelyImage(src)) {
      const fetchPosterSecurely = async () => {
        try {
          // 1. Bypass local SSL blocks by proxying the OMDb API request through corsproxy
          const omdbUrl = `https://www.omdbapi.com/?apikey=thewdb&t=${encodeURIComponent(alt)}`;
          const proxyApiUrl = `https://corsproxy.io/?url=${encodeURIComponent(omdbUrl)}`;
          
          const res = await fetch(proxyApiUrl);
          const data = await res.json();
          
          if (data.Poster && data.Poster !== 'N/A') {
            // 2. Wrap the resulting Amazon/TMDB image URL in a trusted CDN proxy (wsrv.nl) to bypass client-side SSL blocking on the image itself
            setRealSrc(`https://wsrv.nl/?url=${encodeURIComponent(data.Poster)}&w=800&h=1200&fit=cover`);
            return;
          }
          setRealSrc(`https://picsum.photos/seed/${encodeURIComponent(alt)}/800/1200`);
        } catch (err) {
          setRealSrc(`https://picsum.photos/seed/${encodeURIComponent(alt)}/800/1200`);
        }
      };
      
      const timeout = setTimeout(fetchPosterSecurely, 100);
      return () => clearTimeout(timeout);
    } else {
      // If the URL is valid but the network blocks it, wrap the original image in the CDN proxy too!
      if (src && src.startsWith('http')) {
        setRealSrc(`https://wsrv.nl/?url=${encodeURIComponent(src)}&w=800&h=1200&fit=cover`);
      } else {
        setRealSrc(src);
      }
    }
  }, [src, alt, error]);

  return (
    <div className={cn("relative overflow-hidden bg-surface-container", className)}>
      {loading && <div className="absolute inset-0 animate-pulse bg-white/5" />}
      <img
        src={realSrc}
        alt={alt}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-500",
          loading ? "opacity-0" : "opacity-100"
        )}
        onLoad={() => setLoading(false)}
        onError={() => {
          if (!error) setError(true);
          setLoading(false);
        }}
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

export default function App() {
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [watchlist, setWatchlist] = useState(() => {
    const saved = localStorage.getItem('moviechat_watchlist');
    return saved ? JSON.parse(saved) : [];
  });
  const [watchedList, setWatchedList] = useState(() => {
    const saved = localStorage.getItem('moviechat_watched');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeTab, setActiveTab] = useState('discover');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const chatEndRef = useRef(null);

  const currentSession = sessions.find(s => s.id === currentSessionId);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages]);

  useEffect(() => {
    localStorage.setItem('moviechat_watchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    localStorage.setItem('moviechat_watched', JSON.stringify(watchedList));
  }, [watchedList]);

  const handleNewChat = () => {
    const newSession = {
      id: Date.now().toString(),
      title: 'New Conversation',
      messages: [],
      timestamp: Date.now()
    };
    setSessions([newSession, ...sessions]);
    setCurrentSessionId(newSession.id);
    setActiveTab('discover');
    setIsSidebarOpen(false);
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    let sessionId = currentSessionId;
    if (!sessionId) {
      const newSession = {
        id: Date.now().toString(),
        title: input.slice(0, 30) + '...',
        messages: [],
        timestamp: Date.now()
      };
      setSessions([newSession, ...sessions]);
      sessionId = newSession.id;
      setCurrentSessionId(sessionId);
    }

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    setSessions(prev => prev.map(s =>
      s.id === sessionId
        ? { ...s, messages: [...s.messages, userMessage], title: s.messages.length === 0 ? input.slice(0, 30) : s.title }
        : s
    ));
    setInput('');
    setIsLoading(true);

    try {
      const history = currentSession?.messages.map(m => ({ role: m.role, content: m.content })) || [];
      const result = await getMovieRecommendations(input, history);

      const aiMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.analysis,
        movies: result.recommendations.map((m, i) => ({ ...m, id: `${Date.now()}-${i}` })),
        timestamp: Date.now()
      };

      setSessions(prev => prev.map(s =>
        s.id === sessionId
          ? { ...s, messages: [...s.messages, aiMessage] }
          : s
      ));
    } catch (error) {
      console.error("Failed to get recommendations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleWatchlist = (movie) => {
    if (watchlist.some(m => m.title === movie.title)) {
      setWatchlist(watchlist.filter(m => m.title !== movie.title));
    } else {
      setWatchlist([...watchlist, movie]);
    }
  };

  const toggleWatched = (movie) => {
    if (watchedList.some(m => m.title === movie.title)) {
      setWatchedList(watchedList.filter(m => m.title !== movie.title));
    } else {
      setWatchedList([...watchedList, movie]);
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-on-surface">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 h-full w-64 border-r border-transparent bg-[#000000] flex flex-col py-8 shadow-[40px_0_40px_-10px_rgba(133,173,255,0.08)] z-50 transition-transform duration-300 md:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="px-6 mb-12 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-[#85adff] font-headline">What'sYourMov</h1>
            <p className="font-manrope tracking-tight font-light text-[10px] uppercase text-slate-500 mt-1">The Digital Curator</p>
          </div>
          <button className="md:hidden p-1 text-slate-400 hover:text-white" onClick={() => setIsSidebarOpen(false)}>
            <Close />
          </button>
        </div>

        <div className="px-4 mb-8">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all duration-300 border border-white/5 group"
          >
            <PlusCircle className="text-primary group-hover:scale-110 transition-transform" />
            <span className="hidden md:inline font-headline font-medium text-sm">New Chat</span>
          </button>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto">
          <button
            onClick={() => { setActiveTab('discover'); setIsSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center gap-4 py-3 px-6 transition-all duration-300 group",
              activeTab === 'discover' ? "bg-[#85adff]/10 text-[#85adff] border-l-4 border-[#85adff]" : "text-slate-400 hover:text-slate-100 hover:bg-white/5"
            )}
          >
            <Explore />
            <span className="font-headline text-sm font-medium">Discover</span>
          </button>

          <button
            onClick={() => { setActiveTab('watchlist'); setIsSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center gap-4 py-3 px-6 transition-all duration-300 group",
              activeTab === 'watchlist' ? "bg-[#85adff]/10 text-[#85adff] border-l-4 border-[#85adff]" : "text-slate-400 hover:text-slate-100 hover:bg-white/5"
            )}
          >
            <Bookmarks />
            <span className="font-headline text-sm font-medium">Watchlist</span>
          </button>

          <button
            onClick={() => { setActiveTab('watched'); setIsSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center gap-4 py-3 px-6 transition-all duration-300 group",
              activeTab === 'watched' ? "bg-[#85adff]/10 text-[#85adff] border-l-4 border-[#85adff]" : "text-slate-400 hover:text-slate-100 hover:bg-white/5"
            )}
          >
            <AutoAwesome />
            <span className="font-headline text-sm font-medium">Watched</span>
          </button>

        </nav>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 ml-0 md:ml-64 min-h-screen flex flex-col relative transition-all duration-500",
        selectedMovie && "lg:mr-[400px]"
      )}>
        <header className="fixed top-0 right-0 left-0 md:left-64 z-30 bg-[#000000]/60 backdrop-blur-xl flex justify-between items-center h-16 px-6 md:px-8 border-b border-white/5 transition-all">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-2 -ml-2 rounded-lg hover:bg-white/5 text-slate-400" onClick={() => setIsSidebarOpen(true)}>
              <Menu />
            </button>
            <MovieIcon className="text-primary hidden md:block" />
            <span className="text-lg font-bold tracking-tighter text-slate-100 font-headline hidden sm:inline">What'sYourMov</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 text-slate-400">
              <Coffee className="hover:text-primary cursor-pointer transition-colors" />
            </div>
          </div>
        </header>

        <section className="flex-1 mt-16 px-4 md:px-12 py-8 md:py-12 max-w-4xl mx-auto w-full overflow-y-auto">
          {activeTab === 'discover' ? (
            <div className="space-y-12">
              {!currentSession || currentSession.messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6">
                  <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center border border-primary/20">
                    <AutoAwesome className="text-primary w-10 h-10" fill />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-3xl font-headline font-black text-white">Welcome, Cinephile</h2>
                    <p className="text-slate-500 max-w-md">I am your Digital Curator. Tell me about your mood, a movie you loved, or a visual style you crave.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-lg">
                    {["Visually stunning sci-fi like Blade Runner", "Neo-noir mysteries with deep themes", "Grand scale space epics", "Intimate philosophical dramas"].map(suggestion => (
                      <button
                        key={suggestion}
                        onClick={() => setInput(suggestion)}
                        className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 text-left text-sm transition-all"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                currentSession.messages.map((message) => (
                  <div key={message.id} className="space-y-12">
                    {message.role === 'user' ? (
                      <div className="flex items-start gap-6 group">
                        <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center shrink-0 border border-white/5">
                          <Person className="text-slate-400" />
                        </div>
                        <div className="pt-2">
                          <p className="text-on-surface text-lg font-light leading-relaxed">
                            {message.content}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-6">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                          <AutoAwesome className="text-primary" fill />
                        </div>
                        <div className="pt-2 space-y-8 flex-1">
                          <div className="prose prose-invert max-w-none">
                            <div className="text-on-surface-variant text-lg leading-relaxed">
                              <ReactMarkdown>{message.content}</ReactMarkdown>
                            </div>
                          </div>

                          {message.movies && (
                            <div className="flex flex-col gap-6">
                              {message.movies.map((movie) => (
                                <div
                                  key={movie.id}
                                  className="group cursor-pointer bg-surface-container/30 rounded-2xl overflow-hidden border border-white/5 hover:bg-white/5 transition-all"
                                  onClick={() => setSelectedMovie(movie)}
                                >
                                  <div className="flex flex-col md:flex-row gap-6 p-4">
                                    <MoviePoster
                                      src={movie.posterUrl}
                                      alt={movie.title}
                                      className="w-full md:w-48 aspect-[2/3] rounded-xl shrink-0"
                                    />
                                    <div className="flex-1 flex flex-col justify-center py-2">
                                      <div className="flex items-center gap-3 mb-2">
                                        {movie.isMustWatch && (
                                          <span className="bg-secondary-container text-on-secondary-container text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider font-label">Must Watch</span>
                                        )}
                                        <span className="text-tertiary text-xs font-bold">{movie.rating} Rating</span>
                                      </div>
                                      <h3 className="text-2xl font-headline font-black text-white uppercase mb-2">{movie.title}</h3>
                                      <div className="flex items-center gap-4 text-xs font-label text-slate-500 uppercase tracking-widest mb-4">
                                        <span>{movie.year}</span>
                                        <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
                                        <span>{movie.genre.join(', ')}</span>
                                      </div>
                                      <p className="text-on-surface-variant leading-relaxed text-sm line-clamp-3 mb-4">
                                        {movie.description}
                                      </p>
                                      <div className="flex flex-wrap gap-2 mt-auto">
                                        {movie.tags.map(tag => (
                                          <span key={tag} className="text-[10px] bg-surface-container-high px-2 py-0.5 rounded text-slate-400">{tag}</span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
              {isLoading && (
                <div className="flex items-start gap-6 animate-pulse">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                    <AutoAwesome className="text-primary/50" fill />
                  </div>
                  <div className="pt-2 space-y-4 flex-1">
                    <div className="h-4 bg-white/5 rounded w-3/4"></div>
                    <div className="h-4 bg-white/5 rounded w-1/2"></div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          ) : (
            <div className="space-y-8">
              <h2 className="text-4xl font-headline font-black text-white">
                {activeTab === 'watchlist' ? 'Your Watchlist' : 'Watched Archives'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(activeTab === 'watchlist' ? watchlist : watchedList).map(movie => (
                  <div
                    key={movie.id}
                    className="group cursor-pointer flex gap-4 items-center p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all"
                    onClick={() => setSelectedMovie(movie)}
                  >
                    <MoviePoster
                      src={movie.posterUrl}
                      alt={movie.title}
                      className="w-24 h-32 rounded-lg"
                    />
                    <div>
                      <h4 className="font-headline font-bold text-on-surface uppercase">{movie.title}</h4>
                      <p className="text-sm text-slate-500 mt-1 line-clamp-2">{movie.description}</p>
                      <div className="flex gap-2 mt-2">
                        <span className="text-[10px] bg-surface-container-high px-2 py-0.5 rounded text-slate-400">{movie.year}</span>
                        <span className="text-[10px] bg-surface-container-high px-2 py-0.5 rounded text-slate-400">{movie.rating}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {(activeTab === 'watchlist' ? watchlist : watchedList).length === 0 && (
                  <div className="col-span-full py-20 text-center space-y-4">
                    <Bookmarks className="w-12 h-12 text-slate-700 mx-auto" />
                    <p className="text-slate-500">Nothing here yet. Start exploring to build your collection.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Input Bar */}
        <div className="sticky bottom-0 w-full px-6 md:px-12 pb-8 pt-4 bg-gradient-to-t from-background via-background to-transparent z-30">
          <div className="max-w-4xl mx-auto">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-[2rem] blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-500"></div>
              <div className="relative flex items-center gap-4 bg-surface-container-lowest border border-outline-variant/10 rounded-[2rem] p-2 pl-6 shadow-2xl">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1 bg-transparent border-none focus:ring-0 text-on-surface py-3 font-body text-base placeholder:text-slate-600"
                  placeholder="Ask the Digital Curator anything..."
                  type="text"
                />
                <div className="flex items-center gap-2 pr-2">
                  <button className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/5 transition-all">
                    <AttachFile />
                  </button>
                  <button
                    onClick={handleSendMessage}
                    disabled={isLoading}
                    className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <ArrowUpward />
                  </button>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-center text-slate-600 mt-3 font-label tracking-widest uppercase">The Curator can make mistakes. Verify critical movie details.</p>
          </div>
        </div>
      </main>

      {/* Movie Detail Sidebar */}
      <AnimatePresence>
        {selectedMovie && (
          <motion.aside
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full md:w-[400px] bg-surface-container-low border-l border-outline-variant/5 flex-col overflow-y-auto z-[60]"
          >
            <div className="relative w-full aspect-[4/5] overflow-hidden">
              <MoviePoster
                src={selectedMovie.posterUrl}
                alt={selectedMovie.title}
                className="w-full h-full"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-container-low via-transparent to-transparent"></div>
              <button
                onClick={() => setSelectedMovie(null)}
                className="absolute top-6 right-6 w-10 h-10 rounded-full glass-panel flex items-center justify-center text-white hover:bg-white/20 transition-all"
              >
                <Close />
              </button>
            </div>

            <div className="px-8 -mt-20 relative z-10 pb-12">
              <div className="flex items-end justify-between mb-6">
                <div>
                  <h2 className="text-4xl font-headline font-black text-white leading-none uppercase">{selectedMovie.title}</h2>
                  <p className="text-primary font-medium mt-2">Directed by {selectedMovie.director}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-tertiary mb-1">
                    <Star className="text-sm" fill />
                    <span className="font-bold">{selectedMovie.rating}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-label uppercase">IMDb Score</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-8">
                {selectedMovie.genre.map(g => (
                  <span key={g} className="px-3 py-1 rounded-full bg-surface-container-highest text-slate-300 text-xs font-medium">{g}</span>
                ))}
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">The Premise</h4>
                  <p className="text-on-surface-variant leading-relaxed font-body text-sm">
                    {selectedMovie.description}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-surface-container p-4 rounded-xl border border-outline-variant/10">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">
                      {selectedMovie.runtime?.toLowerCase().includes('season') ? 'Seasons' : 'Runtime'}
                    </p>
                    <p className="font-bold text-on-surface">{selectedMovie.runtime}</p>
                  </div>
                  <div className="bg-surface-container p-4 rounded-xl border border-outline-variant/10">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Release</p>
                    <p className="font-bold text-on-surface">{selectedMovie.releaseDate}</p>
                  </div>
                </div>
                <div className="pt-4 space-y-3">
                  <button
                    onClick={() => toggleWatchlist(selectedMovie)}
                    className={cn(
                      "w-full py-4 rounded-xl font-headline font-bold text-sm shadow-xl transition-all hover:scale-[1.02]",
                      watchlist.some(m => m.title === selectedMovie.title)
                        ? "bg-white/10 text-white border border-white/10"
                        : "bg-gradient-to-r from-primary to-primary-container text-on-primary shadow-primary/10"
                    )}
                  >
                    {watchlist.some(m => m.title === selectedMovie.title) ? 'Remove from Watchlist' : 'Add to Watchlist'}
                  </button>
                  <button
                    onClick={() => toggleWatched(selectedMovie)}
                    className={cn(
                      "w-full py-4 rounded-xl border font-headline font-bold text-sm transition-all",
                      watchedList.some(m => m.title === selectedMovie.title)
                        ? "bg-secondary/20 text-secondary border-secondary/20"
                        : "bg-white/5 border-white/5 text-white hover:bg-white/10"
                    )}
                  >
                    {watchedList.some(m => m.title === selectedMovie.title) ? 'Mark as Unwatched' : 'Mark as Watched'}
                  </button>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}

