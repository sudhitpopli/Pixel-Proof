#!/usr/bin/env python3
import cv2
import os
import argparse
import sys
import pandas as pd

# Try to import dependencies with fallback
try:
    from colordescriptor import ColorDescriptor
    from search_api import Searcher
except ImportError:
    ColorDescriptor = None
    Searcher = None

def search_logo(image_path, index_path="logos.csv", mapping_path="mapping.csv", threshold=0.05):
    """
    Search for similar logos in the index and return top matching company if distance < threshold
    
    Args:
        image_path: Path to the query image
        index_path: Path to the index CSV file (default: index.csv)
        mapping_path: Path to the mapping CSV file (default: mapping.csv)
        threshold: Maximum distance to return a match (default: 0.05)
    
    Returns:
        dict: {
            'found': bool,
            'company': str or None,
            'distance': float or None,
            'error': str or None
        }
    """
    try:
        # Check if dependencies are available
        if ColorDescriptor is None or Searcher is None:
            return {
                'found': False,
                'company': None,
                'distance': None,
                'error': 'ColorDescriptor or Searcher not available. Please install dependencies.'
            }
        
        # Get base directory (where this file is located)
        BASE_DIR = os.path.dirname(os.path.abspath(__file__))
        
        # Resolve paths relative to BASE_DIR
        if not os.path.isabs(index_path):
            index_path = os.path.join(BASE_DIR, index_path)
        if not os.path.isabs(mapping_path):
            mapping_path = os.path.join(BASE_DIR, mapping_path)
        
        # Load mapping if it exists
        mapping = {}
        if os.path.exists(mapping_path):
            try:
                df = pd.read_csv(mapping_path)
                mapping = dict(zip(df['filename'], df['company']))
            except Exception as e:
                print(f"⚠️  Warning: Could not load mapping file: {e}")
        else:
            print(f"⚠️  Warning: Mapping file not found at {mapping_path}")
        
        # Check if index file exists
        if not os.path.exists(index_path):
            return {
                'found': False,
                'company': None,
                'distance': None,
                'error': f'Index file not found at {index_path}'
            }
        
        # Check if image file exists
        if not os.path.exists(image_path):
            return {
                'found': False,
                'company': None,
                'distance': None,
                'error': f'Image file not found at {image_path}'
            }
        
        # Extract query features
        cd = ColorDescriptor((8, 12, 3))
        query_image = cv2.imread(image_path)
        if query_image is None:
            return {
                'found': False,
                'company': None,
                'distance': None,
                'error': f'Cannot load image from {image_path}'
            }
        
        query_features = cd.describe(query_image)
        
        # Search
        indexer = Searcher(index_path)
        results = indexer.search(query_features, limit=1)  # Only need top result
        
        if not results:
            return {
                'found': False,
                'company': None,
                'distance': None,
                'error': 'No search results returned'
            }
        
        # Get top result
        dist, fname = results[0]
        # Convert numpy types to Python native types for JSON serialization
        dist = float(dist)
        company = mapping.get(fname, fname)  # Fallback to filename if no mapping
        
        # Check if distance is below threshold
        if dist < threshold:
            return {
                'found': True,
                'company': company,
                'distance': dist,
                'error': None
            }
        else:
            return {
                'found': False,
                'company': None,
                'distance': dist,
                'error': f'Distance {dist:.4f} exceeds threshold {threshold}'
            }
            
    except Exception as e:
        return {
            'found': False,
            'company': None,
            'distance': None,
            'error': str(e)
        }


# CLI interface (for backwards compatibility)
if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Logo similarity search with company names")
    ap.add_argument("-q", "--query", required=True, help="Path to query image")
    ap.add_argument("-i", "--index", default="index.csv", help="Path to index CSV")
    ap.add_argument("-m", "--mapping", default="mapping.csv", help="filename → company mapping.csv")
    ap.add_argument("-l", "--limit", type=int, default=5, help="Top N results")
    ap.add_argument("-t", "--threshold", type=float, default=0.05, help="Distance threshold")
    args = vars(ap.parse_args())
    
    result = search_logo(args["query"], args["index"], args["mapping"], args["threshold"])
    
    if result['found']:
        print(f"✅ Match found: {result['company']} (distance: {result['distance']:.4f})")
    else:
        print(f"❌ No match found: {result.get('error', 'Unknown error')}")
        if result.get('distance'):
            print(f"   Distance: {result['distance']:.4f}")
