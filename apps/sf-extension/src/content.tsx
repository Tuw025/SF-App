import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';

interface Meaning {
  translatedText: string;
  englishExplanation?: string;
  partOfSpeech?: string;
  ipa: string;
  isIdiom?: boolean;
  normalizedWord?: string;
  detectedLanguage?: string;
}

const Popup = () => {
  const [selectedText, setSelectedText] = useState('');
  const [contextSentence, setContextSentence] = useState('');
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [meaning, setMeaning] = useState<Meaning | null>(null);
  const [quickIpa, setQuickIpa] = useState<string>('');
  const [quickMeaning, setQuickMeaning] = useState<string>('');
  
  const [loadingTranslate, setLoadingTranslate] = useState(false);
  const [loadingSave, setLoadingSave] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      if (popupRef.current && popupRef.current.contains(e.target as Node)) return;

      const selection = window.getSelection();
      const text = selection?.toString().trim();
      
      if (text && text.length > 0 && text.length < 50) {
        setSelectedText(text);
        const getFullSentence = (selection: Selection) => {
          const node = selection.anchorNode;
          if (!node || !node.textContent) return "";
          const text = node.textContent;
          const offset = selection.anchorOffset;
          
          const punctuationRegex = /[.!?。！？]/g;
          let match;
          let start = 0;
          let end = text.length;
          
          while ((match = punctuationRegex.exec(text)) !== null) {
            if (match.index < offset) {
              start = match.index + 1;
            } else if (match.index > offset) {
              end = match.index + 1;
              break;
            }
          }
          
          return text.substring(start, end).trim();
        };

        const sentence = getFullSentence(selection) || text;
        setContextSentence(sentence);

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        setPosition({
          top: rect.bottom + window.scrollY + 12,
          left: rect.left + window.scrollX
        });
        
        setMeaning(null);
        setQuickIpa('');
        setQuickMeaning('');
        setSaveStatus('idle');
        setErrorMessage('');
        setLoadingTranslate(true);

        // 0. Gọi nhanh API từ điển mở (Chỉ áp dụng cho tiếng Anh) để lấy nghĩa cơ bản ngay lập tức
        if (/^[a-zA-Z\s]+$/.test(text)) {
          fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${text}`)
            .then(res => res.json())
            .then(data => {
              if (data && data[0]) {
                const phonetic = data[0].phonetics?.find((p: any) => p.text)?.text || data[0].phonetic || '';
                const def = data[0].meanings?.[0]?.definitions?.[0]?.definition || '';
                if (phonetic) setQuickIpa(phonetic);
                if (def) setQuickMeaning(def);
              }
            }).catch(() => {});
        }

        // 1. Gọi dịch nghĩa (AI)
        chrome.runtime.sendMessage({
          type: 'TRANSLATE_WORD',
          payload: {
            originalText: text,
            contextSentence: sentence,
            // Xóa hardcode language: 'en' để AI tự detect
          }
        }, (response) => {
          setLoadingTranslate(false);
          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
            setErrorMessage("Lỗi kết nối Extension");
            return;
          }
          if (response?.status === 'success' && response.data) {
            setMeaning({
              translatedText: response.data.translatedText,
              englishExplanation: response.data.englishExplanation,
              ipa: response.data.ipa,
              isIdiom: response.data.isIdiom,
              partOfSpeech: response.data.partOfSpeech,
              normalizedWord: response.data.normalizedWord,
              detectedLanguage: response.data.detectedLanguage
            });
          } else {
            setErrorMessage(response?.message || "Không thể dịch từ này");
          }
        });

      } else {
        setSelectedText('');
      }
    };
    
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const handleSave = () => {
    if (!meaning) return;
    setLoadingSave(true);
    
    // 2. Gọi API lưu trữ khi người dùng chủ động click
    chrome.runtime.sendMessage({
      type: 'SAVE_WORD',
      payload: {
        originalText: meaning.normalizedWord || selectedText,
        translatedText: meaning.translatedText,
        contextSentence: contextSentence,
        language: meaning.detectedLanguage || 'en',
        ipa: meaning.ipa,
        isIdiom: meaning.isIdiom,
        partOfSpeech: meaning.partOfSpeech,
        englishExplanation: meaning.englishExplanation
      }
    }, (response) => {
      setLoadingSave(false);
      if (response?.status === 'success') {
        setSaveStatus('success');
        setTimeout(() => setSelectedText(''), 2500); // Ẩn popup sau 2.5s
      } else {
        setSaveStatus('error');
        setErrorMessage(response?.message || "Lưu thất bại. Có thể bạn chưa đăng nhập (NextAuth).");
      }
    });
  };

  if (!selectedText) return null;

  return (
    <div ref={popupRef} 
         style={{ 
           position: 'absolute', 
           top: `${position.top}px`, 
           left: `${position.left}px`,
           zIndex: 2147483647,
           backgroundColor: '#ffffff',
           border: '1px solid #e2e8f0',
           borderRadius: '16px',
           boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
           padding: '20px',
           minWidth: '280px',
           maxWidth: '350px',
           fontFamily: 'system-ui, -apple-system, sans-serif',
           color: '#1e293b'
         }}
    >
      <div style={{
        position: 'absolute', top: '-6px', left: '20px', width: '12px', height: '12px',
        backgroundColor: '#ffffff', borderTop: '1px solid #e2e8f0', borderLeft: '1px solid #e2e8f0', transform: 'rotate(45deg)'
      }}></div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', position: 'relative' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#0f172a' }}>
            {meaning?.normalizedWord || selectedText}
          </h3>
          {(meaning as any)?.partOfSpeech && (
            <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', display: 'block', marginTop: '2px' }}>
              {(meaning as any).partOfSpeech}
            </span>
          )}
        </div>
        {(meaning?.ipa || quickIpa) && (
          <span style={{ fontSize: '12px', backgroundColor: '#eff6ff', color: '#2563eb', padding: '4px 8px', borderRadius: '6px', fontFamily: 'monospace', marginLeft: '10px' }}>
            {meaning?.ipa || quickIpa}
          </span>
        )}
      </div>
      
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .5; }
        }
      `}</style>

      {loadingTranslate ? (
        <div style={{ margin: '16px 0' }}>
          {quickMeaning ? (
            <>
              <p style={{ fontSize: '14px', color: '#475569', marginBottom: '8px' }}>🇬🇧 <span style={{ fontStyle: 'italic' }}>{quickMeaning}</span></p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', animation: 'pulse 1.5s infinite' }}>
                <span style={{ fontSize: '12px' }}>✨</span>
                <p style={{ fontSize: '12px', color: '#3b82f6', fontWeight: 500, margin: 0 }}>AI đang dịch theo ngữ cảnh...</p>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', animation: 'pulse 1.5s infinite' }}>
              <div style={{ height: '16px', width: '80%', backgroundColor: '#e2e8f0', borderRadius: '4px' }}></div>
              <div style={{ height: '16px', width: '60%', backgroundColor: '#e2e8f0', borderRadius: '4px' }}></div>
            </div>
          )}
        </div>
      ) : meaning ? (
        <div style={{ margin: '16px 0' }}>
          <p style={{ fontSize: '16px', color: '#334155', fontWeight: 500, margin: '0 0 10px 0' }}>
            {meaning.translatedText}
          </p>
          {meaning.englishExplanation && (
            <div style={{ 
              fontSize: '13px', 
              color: '#475569', 
              backgroundColor: '#f8fafc',
              padding: '10px 12px',
              borderRadius: '8px',
              borderLeft: '3px solid #3b82f6',
              lineHeight: '1.4'
            }}>
              <span style={{fontWeight: 600, color: '#3b82f6', display: 'block', marginBottom: '4px'}}>💡 Context Meaning:</span>
              {meaning.englishExplanation}
            </div>
          )}
        </div>
      ) : (
        <p style={{ fontSize: '14px', color: '#ef4444', fontStyle: 'italic', margin: '16px 0' }}>{errorMessage || "Lỗi dịch thuật"}</p>
      )}

      {meaning && (
        <button 
          onClick={handleSave}
          disabled={loadingSave || saveStatus === 'success'}
          style={{
            width: '100%',
            padding: '12px',
            border: 'none',
            borderRadius: '10px',
            backgroundColor: saveStatus === 'success' ? '#10b981' : saveStatus === 'error' ? '#ef4444' : '#0f172a',
            color: 'white',
            fontWeight: 'bold',
            cursor: (loadingSave || saveStatus === 'success') ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            marginTop: '8px',
            opacity: loadingSave ? 0.7 : 1
          }}
        >
          {loadingSave ? 'Đang lưu...' : saveStatus === 'success' ? '✔ Đã lưu vào SF' : saveStatus === 'error' ? '✖ Lưu thất bại' : 'Lưu vào hệ thống SF'}
        </button>
      )}
      {saveStatus === 'error' && <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '8px' }}>{errorMessage}</p>}
    </div>
  );
};

const rootDiv = document.createElement('div');
rootDiv.id = 'sf-extension-root';
document.body.appendChild(rootDiv);
const root = ReactDOM.createRoot(rootDiv);
root.render(<Popup />);
