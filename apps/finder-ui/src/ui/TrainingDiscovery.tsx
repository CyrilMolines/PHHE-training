import { useState } from "preact/hooks";

// Known training sources for health emergencies
const TRAINING_SOURCES = [
  { 
    name: "OpenWHO", 
    url: "https://openwho.org/", 
    category: "WHO", 
    searchUrl: "https://openwho.org/esearch/search?keyword=",
    description: "WHO's interactive learning platform"
  },
  { 
    name: "edX - Public Health", 
    url: "https://www.edx.org/learn/public-health", 
    category: "MOOC", 
    searchUrl: "https://www.edx.org/search?tab=Course&productType=Course&q=",
    description: "Online courses from top universities"
  },
  { 
    name: "Coursera - Public Health", 
    url: "https://www.coursera.org/browse/health/public-health", 
    category: "MOOC", 
    searchUrl: "https://www.coursera.org/search?query=",
    description: "University courses and certificates"
  },
  { 
    name: "FutureLearn - Health", 
    url: "https://www.futurelearn.com/subjects/healthcare-medicine-courses", 
    category: "MOOC",
    searchUrl: "https://www.futurelearn.com/search?q=",
    description: "Healthcare and medicine courses"
  },
  { 
    name: "CDC TRAIN", 
    url: "https://www.train.org/cdctrain/welcome", 
    category: "CDC", 
    searchUrl: "https://www.train.org/cdctrain/search?query=",
    description: "CDC training resources"
  },
  { 
    name: "FEMA Emergency Management", 
    url: "https://training.fema.gov/is/crslist.aspx", 
    category: "FEMA",
    searchUrl: "https://training.fema.gov/is/searchis.aspx?search=",
    description: "Emergency management courses"
  },
  { 
    name: "DisasterReady", 
    url: "https://ready.csod.com/client/disasterready/default.aspx", 
    category: "Humanitarian",
    description: "Humanitarian learning platform"
  },
  { 
    name: "Kaya (HLA)", 
    url: "https://kayaconnect.org/course/index.php", 
    category: "Humanitarian", 
    searchUrl: "https://kayaconnect.org/course/search.php?q=",
    description: "Humanitarian Leadership Academy"
  },
  { 
    name: "UNHCR", 
    url: "https://www.unhcr.org/what-we-do/build-better-futures/education", 
    category: "UN",
    searchUrl: "https://www.unhcr.org/search?search=",
    description: "UN Refugee Agency resources"
  },
  { 
    name: "ReliefWeb Training", 
    url: "https://reliefweb.int/training", 
    category: "Humanitarian", 
    searchUrl: "https://reliefweb.int/training?search=",
    description: "Humanitarian training opportunities"
  },
  { 
    name: "GOARN LMS", 
    url: "https://goarn.who.int/lms/catalogue", 
    category: "WHO",
    description: "GOARN Training Platform (login required)"
  }
];

// Health emergency keywords for searching
const SEARCH_KEYWORDS = [
  "health emergency",
  "epidemic response",
  "pandemic preparedness",
  "outbreak investigation",
  "disease surveillance",
  "public health emergency"
];

export function TrainingDiscovery() {
  const [searchQuery, setSearchQuery] = useState("public health emergency");

  function searchSource(source: typeof TRAINING_SOURCES[0]) {
    if (source.searchUrl) {
      const query = encodeURIComponent(searchQuery);
      window.open(source.searchUrl + query, '_blank');
    } else {
      window.open(source.url, '_blank');
    }
  }

  return (
    <div class="discovery-container">
      <div class="discovery-header">
        <div class="discovery-header-text">
          <span class="discovery-title">Training Platform Search</span>
          <span class="discovery-subtitle">Search health emergency training platforms</span>
        </div>
      </div>

      <div class="discovery-content">
        {/* Search Section */}
        <div class="discovery-section search-section">
          <h3>Search Query</h3>
          <p class="section-desc">Enter keywords to search across training platforms</p>
          <div class="search-input-group">
            <input
              type="text"
              placeholder="Enter search terms..."
              value={searchQuery}
              onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
              class="search-input"
            />
          </div>
          <div class="quick-searches">
            <span class="quick-label">Quick searches:</span>
            {SEARCH_KEYWORDS.map((kw, i) => (
              <button 
                key={i} 
                class="keyword-btn"
                onClick={() => setSearchQuery(kw)}
              >
                {kw}
              </button>
            ))}
          </div>
        </div>

        {/* Training Sources */}
        <div class="discovery-section">
          <h3>Training Platforms ({TRAINING_SOURCES.length})</h3>
          <p class="section-desc">Click "Search" to open the platform with your search query</p>
          <div class="sources-list">
            {TRAINING_SOURCES.map((source, i) => (
              <div key={i} class="source-row">
                <div class="source-info">
                  <span class="source-name">{source.name}</span>
                  <span class="source-desc">{source.description}</span>
                </div>
                <span class="source-category-badge">{source.category}</span>
                <div class="source-actions">
                  {source.searchUrl ? (
                    <button 
                      class="btn small primary"
                      onClick={() => searchSource(source)}
                    >
                      Search
                    </button>
                  ) : (
                    <a 
                      href={source.url} 
                      target="_blank" 
                      rel="noreferrer" 
                      class="btn small secondary"
                    >
                      Open
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
