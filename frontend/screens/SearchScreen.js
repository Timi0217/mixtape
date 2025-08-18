import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';

const SearchScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    // Mock search results
    const mockResults = [
      {
        id: 'spotify:123',
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
        platform: 'spotify'
      },
      {
        id: 'apple:456',
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
        platform: 'apple-music'
      }
    ];
    
    setResults(mockResults);
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <ScrollView 
        style={styles.container}
        keyboardShouldPersistTaps="handled"
      >
      <View style={styles.header}>
        <Text style={styles.title}>Search Music</Text>
        <Text style={styles.subtitle}>Find songs across all platforms</Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search for songs..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
        />
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {/* Results */}
      {results.map((song, index) => (
        <View key={index} style={styles.songItem}>
          <View style={styles.songInfo}>
            <Text style={styles.songTitle}>{song.title}</Text>
            <Text style={styles.songArtist}>{song.artist}</Text>
            <Text style={styles.songPlatform}>{song.platform}</Text>
          </View>
          <TouchableOpacity 
            style={styles.selectButton}
            onPress={() => Alert.alert('Selected', `Added ${song.title}`)}
          >
            <Text style={styles.selectButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
      ))}

      {results.length === 0 && searchQuery && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            Search for songs to see results from Spotify and Apple Music
          </Text>
        </View>
      )}
      </ScrollView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa', // Clean light gray background
  },
  header: {
    padding: 20,
    backgroundColor: '#ffffff', // Pure white
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a', // Rich black text
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280', // Medium gray
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#ffffff', // Pure white
    margin: 16,
    borderRadius: 16, // Modern rounded corners
    shadowColor: 'rgba(0, 0, 0, 0.1)', // Modern subtle shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    padding: 12,
    backgroundColor: '#f1f3f4', // Light gray tint
    borderRadius: 8,
    marginRight: 12,
    color: '#1a1a1a',
  },
  searchButton: {
    backgroundColor: '#8B5CF6', // Purple - primary actions
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  searchButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  songItem: {
    flexDirection: 'row',
    backgroundColor: '#ffffff', // Pure white
    margin: 8,
    padding: 16,
    borderRadius: 16, // Modern rounded corners
    alignItems: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.1)', // Modern subtle shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  songInfo: {
    flex: 1,
  },
  songTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a', // Rich black text
  },
  songArtist: {
    fontSize: 14,
    color: '#6b7280', // Medium gray
    marginTop: 2,
  },
  songPlatform: {
    fontSize: 12,
    color: '#8B5CF6', // Purple accent
    marginTop: 4,
    fontWeight: '600',
  },
  selectButton: {
    backgroundColor: '#8B5CF6', // Purple primary button
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  selectButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
});

export default SearchScreen;