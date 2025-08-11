import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface Exercise {
  exerciseName: string;
  timestamp: string;
  howToPerform: string;
}

type ViewState = 'loading' | 'no-results' | 'results';

const Sidepanel: React.FC = () => {
  const { user, signOut } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [viewState, setViewState] = useState<ViewState>('no-results');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [videoTitle, setVideoTitle] = useState('');
  const [currentTabId, setCurrentTabId] = useState<number | undefined>();
  const [currentUrl, setCurrentUrl] = useState('');
  const [isYouTubeVideo, setIsYouTubeVideo] = useState(false);
  const [saveKeyText, setSaveKeyText] = useState('Save Key');

  const navigateToTimestamp = useCallback((timestamp: string) => {
    if (!currentTabId) {
      console.error('No current tab ID available for navigation');
      return;
    }

    console.log('Sending navigateToTimestamp message via background:', {
      timestamp,
      currentTabId,
    });

    chrome.runtime.sendMessage(
      {
        action: 'navigateToTimestamp',
        timestamp: timestamp,
        tabId: currentTabId,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            'Could not send message to background script:',
            chrome.runtime.lastError
          );
        } else if (response && !response.success) {
          console.error('Background script reported error:', response.error);
        } else {
          console.log('Navigation message successful:', response);
        }
      }
    );
  }, [currentTabId]);

  const loadApiKey = useCallback(() => {
    chrome.storage.sync.get(['geminiApiKey'], (result) => {
      if (result.geminiApiKey) {
        setApiKey(result.geminiApiKey);
      }
    });
  }, []);

  const saveApiKey = useCallback(() => {
    const key = apiKey.trim();
    if (key) {
      chrome.storage.sync.set({ geminiApiKey: key }, () => {
        console.log('API key saved');
        setSaveKeyText('Saved!');
        setTimeout(() => {
          setSaveKeyText('Save Key');
        }, 2000);
      });
    }
  }, [apiKey]);

  const updateTabStatus = useCallback(async () => {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      console.log('Current tab:', tab);

      setCurrentTabId(tab.id);
      setCurrentUrl(tab.url || '');
      setIsYouTubeVideo((tab.url || '').includes('youtube.com/watch'));

      console.log('Tab URL:', tab.url);
      console.log('Tab ID:', tab.id);
      console.log('Is YouTube video:', (tab.url || '').includes('youtube.com/watch'));
    } catch (error) {
      console.error('Error checking tab status:', error);
      setIsYouTubeVideo(false);
    }
  }, []);

  const extractExercises = useCallback(() => {
    console.log('Extract exercises button clicked!');

    chrome.storage.sync.get(['geminiApiKey'], (result) => {
      if (!result.geminiApiKey) {
        alert('Please enter your Gemini API key first');
        return;
      }

      if (currentTabId) {
        chrome.tabs.sendMessage(currentTabId, {
          action: 'extractExercises',
          message: 'Extract exercises from video',
          apiKey: result.geminiApiKey,
        });
      }
    });
  }, [currentTabId]);

  const loadExerciseResults = useCallback(async () => {
    try {
      await updateTabStatus();

      if (!isYouTubeVideo) {
        setViewState('no-results');
        return;
      }

      setViewState('loading');

      const result = await chrome.storage.local.get([
        'lastExerciseResults',
        'lastVideoUrl',
        'lastVideoTitle',
      ]);

      if (result.lastExerciseResults && result.lastVideoUrl === currentUrl) {
        setExercises(result.lastExerciseResults);
        setVideoTitle(result.lastVideoTitle || 'Unknown Video');
        setViewState('results');
      } else {
        setViewState('no-results');
      }
    } catch (error) {
      console.error('Error loading exercise results:', error);
      setViewState('no-results');
    }
  }, [currentUrl, isYouTubeVideo, updateTabStatus]);

  const refreshResults = useCallback(async () => {
    console.log('Refresh button clicked');
    await updateTabStatus();
    await loadExerciseResults();
  }, [updateTabStatus, loadExerciseResults]);

  const handleStorageChange = useCallback((changes: {
    [key: string]: chrome.storage.StorageChange;
  }) => {
    if (changes.lastExerciseResults && changes.lastVideoUrl) {
      const exerciseResults = changes.lastExerciseResults.newValue;
      const videoUrl = changes.lastVideoUrl.newValue;
      const videoTitle = changes.lastVideoTitle?.newValue || 'Unknown Video';

      if (videoUrl === currentUrl && exerciseResults) {
        setExercises(exerciseResults);
        setVideoTitle(videoTitle);
        setViewState('results');
      }
    }
  }, [currentUrl]);

  useEffect(() => {
    const initialize = async () => {
      console.log('Initializing side panel...');
      loadApiKey();
      await updateTabStatus();
      await loadExerciseResults();
    };

    initialize();

    chrome.storage.onChanged.addListener(handleStorageChange);

    const handleTabActivated = async () => {
      console.log('Tab activated, updating status');
      await updateTabStatus();
      loadExerciseResults();
    };

    const handleTabUpdated = async (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (changeInfo.url || changeInfo.status === 'complete') {
        console.log('Tab updated:', tabId, changeInfo);
        await updateTabStatus();
        if (tabId === currentTabId) {
          loadExerciseResults();
        }
      }
    };

    chrome.tabs.onActivated.addListener(handleTabActivated);
    chrome.tabs.onUpdated.addListener(handleTabUpdated);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
      chrome.tabs.onActivated.removeListener(handleTabActivated);
      chrome.tabs.onUpdated.removeListener(handleTabUpdated);
    };
  }, [handleStorageChange, loadApiKey, updateTabStatus, loadExerciseResults, currentTabId]);

  const renderTimestampButton = (exercise: Exercise) => {
    const isClickableTimestamp =
      exercise.timestamp !== 'N/A' &&
      exercise.timestamp.match(/^\d+:\d+$|^\d+:\d+:\d+$/);

    if (isClickableTimestamp) {
      return (
        <button
          className="bg-blue-500 text-white px-2 py-0.5 rounded-xl text-xs font-medium border-none cursor-pointer transition-colors hover:bg-blue-600"
          onClick={() => navigateToTimestamp(exercise.timestamp)}
        >
          {exercise.timestamp}
        </button>
      );
    }

    return (
      <span className="bg-gray-500 text-white px-2 py-0.5 rounded-xl text-xs font-medium">
        {exercise.timestamp}
      </span>
    );
  };

  const renderMainContent = () => {
    switch (viewState) {
      case 'loading':
        return (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-gray-600 text-sm">Loading exercise results...</p>
            </div>
          </div>
        );

      case 'no-results':
        return (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-gray-600 mb-2 text-sm">No exercise results found</p>
              <p className="text-xs text-gray-500">
                Navigate to a YouTube video and extract exercises to see results here.
              </p>
            </div>
          </div>
        );

      case 'results':
        return (
          <div className="flex-1 overflow-y-auto">
            <div className="mb-3">
              <h2 className="font-semibold text-gray-800 text-base mb-2">Exercise Results</h2>
            </div>

            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-gray-800 text-sm mb-1">{videoTitle}</h3>
              <p className="text-xs text-blue-700">
                {exercises.length} exercise{exercises.length === 1 ? '' : 's'} found
              </p>
            </div>

            <div className="space-y-3">
              {exercises.length === 0 ? (
                <p className="text-center text-gray-500 italic p-4">
                  No exercises found in this video.
                </p>
              ) : (
                exercises.map((exercise, index) => (
                  <div key={index} className="p-3 border border-gray-200 rounded-lg bg-white shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="m-0 text-gray-800 text-sm font-semibold flex-1 pr-2">
                        {exercise.exerciseName}
                      </h4>
                      {renderTimestampButton(exercise)}
                    </div>
                    <p className="m-0 text-gray-700 leading-relaxed text-xs">
                      {exercise.howToPerform}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="w-full h-full p-4 bg-gray-50">
      <div className="h-full flex flex-col">
        <div className="mb-4 pb-3 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-gray-800">TLDW Extension</h1>
            <button
              onClick={signOut}
              className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1 rounded border border-gray-300 hover:border-gray-400 transition-colors"
              title="Sign Out"
            >
              Sign Out
            </button>
          </div>
          
          {user && (
            <div className="mb-4 p-2 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-700">
                Signed in as: <span className="font-medium">{user.email}</span>
              </p>
            </div>
          )}

          {/* API Key Section */}
          <div className="mb-4">
            <label htmlFor="api-key" className="block text-sm font-medium text-gray-700 mb-2">
              Gemini API Key:
            </label>
            <input
              type="password"
              id="api-key"
              placeholder="Enter your Gemini API key"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-2"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <button
              onClick={saveApiKey}
              className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm transition-colors"
            >
              {saveKeyText}
            </button>
          </div>

          {/* Controls Section */}
          <div>
            {isYouTubeVideo ? (
              <div>
                <p className="text-gray-700 mb-3 text-sm">Extract exercises from this video:</p>
                <div className="space-y-2">
                  <button
                    onClick={extractExercises}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded transition-colors block w-full text-sm"
                  >
                    Extract Exercises
                  </button>
                  <button
                    onClick={refreshResults}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors block w-full text-sm"
                  >
                    Refresh Results
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-gray-600 text-sm">No YouTube video detected</p>
              </div>
            )}
          </div>
        </div>

        {renderMainContent()}
      </div>
    </div>
  );
};

export default Sidepanel;