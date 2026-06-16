import React, { useState, useEffect } from 'react';
import { Plus, Trash2, BookOpen, Home, Search, Edit2 } from 'lucide-react';

let db;

const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('LanguageLearningDB', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    request.onupgradeneeded = (event) => {
      const dbInstance = event.target.result;
      if (!dbInstance.objectStoreNames.contains('vocabulary')) {
        dbInstance.createObjectStore('vocabulary', { keyPath: 'id' });
      }
    };
  });
};

const loadVocabularyFromDB = () => {
  return new Promise((resolve) => {
    if (!db) {
      resolve([]);
      return;
    }
    const request = db.transaction(['vocabulary']).objectStore('vocabulary').getAll();
    request.onsuccess = () => {
      const data = request.result.map(item => ({
        ...item,
        category: item.category || 'Other',
        difficulty: item.difficulty || 'medium'
      }));
      resolve(data);
    };
    request.onerror = () => resolve([]);
  });
};

const saveVocabularyToDB = (vocabList) => {
  if (!db) return;
  const transaction = db.transaction(['vocabulary'], 'readwrite');
  const store = transaction.objectStore('vocabulary');
  store.clear();
  vocabList.forEach(item => store.add(item));
};

export default function LanguageLearningApp() {
  const [mode, setMode] = useState('home');
  const [vocabulary, setVocabulary] = useState([]);
  const [englishInput, setEnglishInput] = useState('');
  const [portugueseInput, setPortugueseInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('Greeting');
  const [difficultyInput, setDifficultyInput] = useState('medium');
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [quizStats, setQuizStats] = useState({ correct: 0, attempted: 0 });
  const [quizComplete, setQuizComplete] = useState(false);
  const [quizDirection, setQuizDirection] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [quizCategory, setQuizCategory] = useState('All');
  const [quizDifficulty, setQuizDifficulty] = useState('All');
  const [editingId, setEditingId] = useState(null);
  const [editCategory, setEditCategory] = useState('');
  const [editDifficulty, setEditDifficulty] = useState('');

  useEffect(() => {
    const initAndLoad = async () => {
      await initDB();
      const data = await loadVocabularyFromDB();
      setVocabulary(data);
    };
    initAndLoad();
  }, []);

  useEffect(() => {
    saveVocabularyToDB(vocabulary);
  }, [vocabulary]);

  const addVocabulary = () => {
    if (englishInput.trim() && portugueseInput.trim()) {
      setVocabulary([...vocabulary, { 
        id: Date.now(), 
        english: englishInput.trim(), 
        portuguese: portugueseInput.trim(),
        category: categoryInput,
        difficulty: difficultyInput,
        timesReviewed: 0,
        lastReviewed: null,
        correctCount: 0
      }]);
      setEnglishInput('');
      setPortugueseInput('');
      setFeedback('Added');
      setTimeout(() => setFeedback(''), 2000);
    }
  };

  const startEditingPhrase = (item) => {
    setEditingId(item.id);
    setEditCategory(item.category);
    setEditDifficulty(item.difficulty);
  };

  const saveEditedPhrase = () => {
    const updatedVocab = vocabulary.map(v =>
      v.id === editingId
        ? { ...v, category: editCategory, difficulty: editDifficulty }
        : v
    );
    setVocabulary(updatedVocab);
    setEditingId(null);
    setFeedback('Updated');
    setTimeout(() => setFeedback(''), 2000);
  };

  const replaceSlang = (text) => {
    const slangMap = {
      'ta': 'esta', 'tá': 'esta', 'cê': 'voce', 'você': 'voce',
      'vc': 'voce', 'pra': 'para', 'pro': 'para', 'tô': 'estou',
      'pq': 'porque', 'n': 'nao', 'nao': 'nao',
    };
    let result = text.toLowerCase();
    for (const [slang, standard] of Object.entries(slangMap)) {
      result = result.replace(new RegExp('\\b' + slang + '\\b', 'g'), standard);
    }
    return result;
  };

  const normalizeText = (text) => {
    let normalized = replaceSlang(text);
    normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    normalized = normalized.replace(/[.,!?;:\-'"]/g, '');
    normalized = normalized.toLowerCase().trim();
    return normalized;
  };

  const checkAnswerMatch = (userText, correctText) => {
    const userNorm = normalizeText(userText);
    const correctNorm = normalizeText(correctText);
    if (userNorm === correctNorm) return true;
    const userWords = userNorm.split(/\s+/).filter(w => w.length > 0);
    const correctWords = correctNorm.split(/\s+/).filter(w => w.length > 0);
    return correctWords.every(word => userWords.includes(word));
  };

  const getSpacedRepetitionScore = (item) => {
    const now = new Date();
    const lastReviewed = item.lastReviewed ? new Date(item.lastReviewed) : new Date(0);
    const daysSinceReview = (now - lastReviewed) / (1000 * 60 * 60 * 24);
    
    let score = daysSinceReview * 10;
    if (item.difficulty === 'hard') score *= 1.5;
    if (item.difficulty === 'easy') score *= 0.5;
    if (item.correctCount === 0) score += 100;
    
    return score;
  };

  const getQuizVocabulary = () => {
    let filtered = vocabulary;
    if (quizCategory !== 'All') {
      filtered = filtered.filter(v => v.category === quizCategory);
    }
    if (quizDifficulty !== 'All') {
      filtered = filtered.filter(v => v.difficulty === quizDifficulty);
    }
    return filtered.sort((a, b) => getSpacedRepetitionScore(b) - getSpacedRepetitionScore(a));
  };

  const getCategories = () => {
    return ['All', ...new Set(vocabulary.map(v => v.category))];
  };

  const getDifficulties = () => {
    return ['All', 'easy', 'medium', 'hard'];
  };

  const getProgress = () => {
    const total = vocabulary.length;
    const mastered = vocabulary.filter(v => v.correctCount >= 3).length;
    const accuracy = quizStats.attempted > 0 ? Math.round((quizStats.correct / quizStats.attempted) * 100) : 0;
    return { total, mastered, accuracy };
  };

  const getFilteredVocabulary = () => {
    let filtered = vocabulary;
    if (searchFilter) {
      filtered = filtered.filter(v => 
        v.english.toLowerCase().includes(searchFilter.toLowerCase()) ||
        v.portuguese.toLowerCase().includes(searchFilter.toLowerCase())
      );
    }
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(v => v.category === selectedCategory);
    }
    if (selectedDifficulty !== 'All') {
      filtered = filtered.filter(v => v.difficulty === selectedDifficulty);
    }
    return filtered;
  };

  const startQuiz = () => {
    const quizVocab = getQuizVocabulary();
    if (quizVocab.length === 0) return;
    setMode('quiz');
    setCurrentQuizIndex(0);
    setUserAnswer('');
    setFeedback('');
    setQuizStats({ correct: 0, attempted: 0 });
    setQuizComplete(false);
    setQuizDirection(null);
  };

  // QUIZ DIRECTION SELECTION
  if (mode === 'quiz' && quizDirection === null) {
    return (
      <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh', padding: '20px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <button onClick={() => { setMode('home'); }} style={{ padding: '8px 16px', border: 'none', borderRadius: '6px', backgroundColor: '#f0f0f0', cursor: 'pointer', marginBottom: '20px', fontSize: '14px' }}>
            Back to Home
          </button>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '20px', color: '#1a1a1a' }}>Choose Quiz Filters</h2>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#333', marginBottom: '8px' }}>Category</label>
              <select value={quizCategory} onChange={(e) => { setQuizCategory(e.target.value); }} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}>
                {getCategories().map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#333', marginBottom: '8px' }}>Difficulty</label>
              <select value={quizDifficulty} onChange={(e) => { setQuizDifficulty(e.target.value); }} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}>
                {getDifficulties().map(diff => <option key={diff} value={diff}>{diff === 'All' ? 'All Difficulties' : diff.charAt(0).toUpperCase() + diff.slice(1)}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <button onClick={() => { setQuizDirection('en-to-pt'); }} style={{ padding: '24px', border: 'none', borderRadius: '12px', backgroundColor: '#2196F3', color: 'white', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>
                English to Portuguese
              </button>
              <button onClick={() => { setQuizDirection('pt-to-en'); }} style={{ padding: '24px', border: 'none', borderRadius: '12px', backgroundColor: '#FF9800', color: 'white', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>
                Portuguese to English
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // QUIZ ACTIVE
  if (mode === 'quiz' && quizDirection && !quizComplete) {
    const quizVocab = getQuizVocabulary();
    if (quizVocab.length === 0) {
      return (
        <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh', padding: '20px' }}>
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <button onClick={() => { setMode('home'); }} style={{ padding: '8px 16px', border: 'none', borderRadius: '6px', backgroundColor: '#f0f0f0', cursor: 'pointer', marginBottom: '20px', fontSize: '14px' }}>
              Back to Home
            </button>
            <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <p style={{ color: '#666' }}>No phrases match your filters</p>
            </div>
          </div>
        </div>
      );
    }

    const current = quizVocab[currentQuizIndex];
    const isEnglishToPortuguese = quizDirection === 'en-to-pt';
    const displayText = isEnglishToPortuguese ? current.english : current.portuguese;
    const correctAnswer = isEnglishToPortuguese ? current.portuguese : current.english;
    const speakLang = isEnglishToPortuguese ? 'en-US' : 'pt-BR';

    const handleSpeak = () => {
      const utterance = new SpeechSynthesisUtterance(displayText);
      utterance.lang = speakLang;
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    };

    const handleListen = () => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setFeedback('Speech recognition not supported');
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.lang = isEnglishToPortuguese ? 'pt-BR' : 'en-US';
      recognition.start();
      recognition.onresult = (event) => {
        const spokenText = event.results[0][0].transcript;
        setUserAnswer(spokenText);
      };
      recognition.onerror = (event) => {
        setFeedback('Error: ' + event.error);
      };
    };

    const checkAnswerNow = () => {
      if (checkAnswerMatch(userAnswer, correctAnswer)) {
        setFeedback('CORRECT');
        const updatedVocab = vocabulary.map(v => 
          v.id === current.id 
            ? { ...v, timesReviewed: v.timesReviewed + 1, lastReviewed: new Date().toISOString(), correctCount: v.correctCount + 1 }
            : v
        );
        setVocabulary(updatedVocab);
        setQuizStats({ correct: quizStats.correct + 1, attempted: quizStats.attempted + 1 });
        setTimeout(() => {
          if (currentQuizIndex < quizVocab.length - 1) {
            setCurrentQuizIndex(currentQuizIndex + 1);
            setUserAnswer('');
            setFeedback('');
          } else {
            setQuizComplete(true);
          }
        }, 1500);
      } else {
        const updatedVocab = vocabulary.map(v => 
          v.id === current.id 
            ? { ...v, timesReviewed: v.timesReviewed + 1, lastReviewed: new Date().toISOString() }
            : v
        );
        setVocabulary(updatedVocab);
        setFeedback('Incorrect. You said: ' + userAnswer + '. Answer: ' + correctAnswer);
        setQuizStats({ ...quizStats, attempted: quizStats.attempted + 1 });
        setUserAnswer('');
      }
    };

    return (
      <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh', padding: '20px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <button onClick={() => { setMode('home'); setQuizDirection(null); setCurrentQuizIndex(0); setUserAnswer(''); setFeedback(''); setQuizComplete(false); }} style={{ padding: '8px 16px', border: 'none', borderRadius: '6px', backgroundColor: '#f0f0f0', cursor: 'pointer', marginBottom: '20px', fontSize: '14px' }}>
            Back to Home
          </button>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <p style={{ margin: 0, fontSize: '12px', color: '#666', marginBottom: '8px' }}>Question {currentQuizIndex + 1} of {quizVocab.length}</p>
            <div style={{ height: '4px', backgroundColor: '#eee', borderRadius: '2px', overflow: 'hidden', marginBottom: '24px' }}>
              <div style={{ height: '100%', backgroundColor: '#4CAF50', width: ((currentQuizIndex + 1) / quizVocab.length) * 100 + '%' }} />
            </div>

            <div style={{ backgroundColor: '#f5f5f5', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#666', marginBottom: '8px' }}>Translate to {isEnglishToPortuguese ? 'Portuguese' : 'English'}:</p>
              <p style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#1a1a1a' }}>{displayText}</p>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              <button onClick={handleSpeak} style={{ flex: 1, padding: '12px', border: 'none', borderRadius: '8px', backgroundColor: '#FF9800', color: 'white', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>
                Speak
              </button>
              <button onClick={handleListen} style={{ flex: 1, padding: '12px', border: 'none', borderRadius: '8px', backgroundColor: '#4CAF50', color: 'white', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>
                Record
              </button>
            </div>

            <p style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>Or type your answer:</p>
            <input type="text" value={userAnswer} onChange={(e) => { setUserAnswer(e.target.value); }} placeholder="Type your answer..." autoFocus style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box', marginBottom: '16px' }} />

            {feedback && <div style={{ padding: '12px', backgroundColor: feedback === 'CORRECT' ? '#d4edda' : '#f8d7da', borderRadius: '6px', marginBottom: '16px', fontSize: '14px', color: feedback === 'CORRECT' ? '#155724' : '#721c24' }}>{feedback}</div>}

            <button onClick={checkAnswerNow} disabled={!userAnswer.trim()} style={{ width: '100%', padding: '12px', border: 'none', borderRadius: '8px', backgroundColor: !userAnswer.trim() ? '#ccc' : '#2196F3', color: 'white', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>
              Check Answer
            </button>
          </div>
        </div>
      </div>
    );
  }

  // QUIZ COMPLETE
  if (mode === 'quiz' && quizComplete) {
    return (
      <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh', padding: '20px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', textAlign: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '24px', color: '#1a1a1a', marginBottom: '12px' }}>Quiz Complete</h2>
            <p style={{ margin: 0, fontSize: '32px', fontWeight: '600', color: '#4CAF50', marginBottom: '20px' }}>{quizStats.correct} / {quizStats.attempted}</p>
            <p style={{ margin: 0, fontSize: '14px', color: '#666', marginBottom: '20px' }}>{Math.round((quizStats.correct / quizStats.attempted) * 100)}% correct</p>
            <button onClick={() => { setMode('home'); setCurrentQuizIndex(0); setUserAnswer(''); setFeedback(''); setQuizComplete(false); setQuizDirection(null); }} style={{ padding: '12px 24px', border: 'none', borderRadius: '8px', backgroundColor: '#2196F3', color: 'white', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // HOME SCREEN
  if (mode === 'home') {
    const progress = getProgress();
    const filteredVocab = getFilteredVocabulary();

    return (
      <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh', padding: '20px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h1 style={{ margin: 0, fontSize: '28px', color: '#1a1a1a' }}>Fale Portugues</h1>
          <p style={{ margin: '8px 0 30px 0', color: '#666', fontSize: '14px' }}>Learn Portuguese from your everyday life</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '30px' }}>
            <button onClick={() => { setMode('input'); }} style={{ padding: '24px', border: 'none', borderRadius: '12px', backgroundColor: '#4CAF50', color: 'white', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>
              Add Vocabulary
            </button>
            <button onClick={startQuiz} style={{ padding: '24px', border: 'none', borderRadius: '12px', backgroundColor: '#2196F3', color: 'white', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>
              Start Quiz
            </button>
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#1a1a1a' }}>Progress</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div style={{ backgroundColor: '#f5f5f5', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>Total</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '20px', fontWeight: '600', color: '#1a1a1a' }}>{progress.total}</p>
              </div>
              <div style={{ backgroundColor: '#f5f5f5', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>Mastered</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '20px', fontWeight: '600', color: '#4CAF50' }}>{progress.mastered}</p>
              </div>
              <div style={{ backgroundColor: '#f5f5f5', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>Accuracy</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '20px', fontWeight: '600', color: '#2196F3' }}>{progress.accuracy}%</p>
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#1a1a1a' }}>Your Vocabulary ({filteredVocab.length})</h2>
            
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button onClick={() => { 
                const dataStr = JSON.stringify(vocabulary, null, 2);
                const dataBlob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(dataBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'vocabulary.json';
                link.click();
              }} style={{ padding: '8px 16px', border: 'none', borderRadius: '6px', backgroundColor: '#4CAF50', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
                Download
              </button>
              
              <input type="file" accept=".json" onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    try {
                      let imported = JSON.parse(event.target.result);
                      imported = imported.map(item => ({
                        ...item,
                        category: item.category || 'Other',
                        difficulty: item.difficulty || 'medium'
                      }));
                      setVocabulary(imported);
                      setFeedback('Imported successfully');
                      setTimeout(() => setFeedback(''), 2000);
                    } catch {
                      setFeedback('Error importing file');
                    }
                  };
                  reader.readAsText(file);
                }
              }} style={{ display: 'none' }} id="fileInput" />
              
              <button onClick={() => { document.getElementById('fileInput').click(); }} style={{ padding: '8px 16px', border: 'none', borderRadius: '6px', backgroundColor: '#2196F3', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
                Upload
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <input type="text" value={searchFilter} onChange={(e) => { setSearchFilter(e.target.value); }} placeholder="Search phrases..." style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '8px' }} />
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <select value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); }} style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}>
                  {getCategories().map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                
                <select value={selectedDifficulty} onChange={(e) => { setSelectedDifficulty(e.target.value); }} style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}>
                  {getDifficulties().map(diff => <option key={diff} value={diff}>{diff === 'All' ? 'All Difficulties' : diff.charAt(0).toUpperCase() + diff.slice(1)}</option>)}
                </select>
              </div>
            </div>

            {feedback && <div style={{ padding: '12px', backgroundColor: '#d4edda', borderRadius: '6px', marginBottom: '16px', fontSize: '14px', color: '#155724' }}>{feedback}</div>}

            {filteredVocab.length === 0 ? (
              <p style={{ color: '#999', margin: 0 }}>No phrases found</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredVocab.map((item) => {
                  const isEditing = editingId === item.id;

                  if (isEditing) {
                    return (
                      <div key={item.id} style={{ padding: '16px', backgroundColor: '#e8f5e9', borderRadius: '8px', border: '2px solid #4CAF50' }}>
                        <p style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#1a1a1a' }}>Editing: {item.english}</p>
                        
                        <div style={{ marginBottom: '12px' }}>
                          <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>Category</label>
                          <select value={editCategory} onChange={(e) => { setEditCategory(e.target.value); }} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}>
                            <option>Greeting</option>
                            <option>Small Talk</option>
                            <option>Work</option>
                            <option>Casual</option>
                            <option>Question</option>
                            <option>Response</option>
                            <option>Goodbye</option>
                            <option>Other</option>
                          </select>
                        </div>

                        <div style={{ marginBottom: '12px' }}>
                          <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>Difficulty</label>
                          <select value={editDifficulty} onChange={(e) => { setEditDifficulty(e.target.value); }} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}>
                            <option value="easy">Easy</option>
                            <option value="medium">Medium</option>
                            <option value="hard">Hard</option>
                          </select>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={saveEditedPhrase} style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '6px', backgroundColor: '#4CAF50', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
                            Save
                          </button>
                          <button onClick={() => { setEditingId(null); }} style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '6px', backgroundColor: '#f0f0f0', color: '#333', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={item.id} style={{ padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>{item.english}</p>
                          <p style={{ margin: '4px 0 0 0', fontSize: '14px', fontWeight: '600', color: '#1a1a1a' }}>{item.portuguese}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => { startEditingPhrase(item); }} style={{ padding: '6px 10px', border: 'none', borderRadius: '6px', backgroundColor: '#e3f2fd', color: '#1976d2', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                            Edit
                          </button>
                          <button onClick={() => { setVocabulary(vocabulary.filter(v => v.id !== item.id)); }} style={{ padding: '6px 10px', border: 'none', borderRadius: '6px', backgroundColor: '#ffebee', color: '#c62828', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                            Delete
                          </button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '12px', flexWrap: 'wrap' }}>
                        <span style={{ backgroundColor: '#e3f2fd', padding: '4px 8px', borderRadius: '4px', color: '#1976d2' }}>{item.category}</span>
                        <span style={{ backgroundColor: '#f3e5f5', padding: '4px 8px', borderRadius: '4px', color: '#7b1fa2' }}>{item.difficulty}</span>
                        <span style={{ backgroundColor: '#e8f5e9', padding: '4px 8px', borderRadius: '4px', color: '#388e3c' }}>Reviewed {item.timesReviewed}x</span>
                        {item.correctCount >= 3 && <span style={{ backgroundColor: '#fff3e0', padding: '4px 8px', borderRadius: '4px', color: '#f57c00' }}>Mastered</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ADD VOCABULARY SCREEN
  if (mode === 'input') {
    return (
      <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh', padding: '20px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <button onClick={() => { setMode('home'); }} style={{ padding: '8px 16px', border: 'none', borderRadius: '6px', backgroundColor: '#f0f0f0', cursor: 'pointer', marginBottom: '20px', fontSize: '14px' }}>
            Back to Home
          </button>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '20px', color: '#1a1a1a' }}>Add New Vocabulary</h2>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#333', marginBottom: '8px' }}>English</label>
              <input type="text" value={englishInput} onChange={(e) => { setEnglishInput(e.target.value); }} placeholder="Good morning, how are you?" style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#333', marginBottom: '8px' }}>Portuguese</label>
              <input type="text" value={portugueseInput} onChange={(e) => { setPortugueseInput(e.target.value); }} placeholder="Bom dia, como voce esta?" style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#333', marginBottom: '8px' }}>Category</label>
              <select value={categoryInput} onChange={(e) => { setCategoryInput(e.target.value); }} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}>
                <option>Greeting</option>
                <option>Small Talk</option>
                <option>Work</option>
                <option>Casual</option>
                <option>Question</option>
                <option>Response</option>
                <option>Goodbye</option>
                <option>Other</option>
              </select>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#333', marginBottom: '8px' }}>Difficulty</label>
              <select value={difficultyInput} onChange={(e) => { setDifficultyInput(e.target.value); }} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            {feedback && <div style={{ padding: '12px', backgroundColor: '#d4edda', borderRadius: '6px', marginBottom: '16px', fontSize: '14px', color: '#155724' }}>{feedback}</div>}
            <button onClick={addVocabulary} style={{ width: '100%', padding: '12px', border: 'none', borderRadius: '8px', backgroundColor: '#4CAF50', color: 'white', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>
              Add Vocabulary
            </button>
          </div>
        </div>
      </div>
    );
  }
}