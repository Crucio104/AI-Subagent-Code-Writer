# filename: tests/test_merge_sort.py
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
from merge_sort import merge_sort

def test_merge_sort_basic():
    # Test with a small unsorted array
    arr = [38, 27, 43, 3, 9, 82, 10]
    expected = [3, 9, 10, 27, 38, 43, 82]
    assert merge_sort(arr) == expected

def test_merge_sort_empty():
    # Test with empty array
    arr = []
    assert merge_sort(arr) == []

def test_merge_sort_single_element():
    # Test with single element
    arr = [42]
    assert merge_sort(arr) == [42]

def test_merge_sort_sorted():
    # Test with already sorted array
    arr = [1, 2, 3, 4, 5]
    assert merge_sort(arr) == [1, 2, 3, 4, 5]

def test_merge_sort_reverse_sorted():
    # Test with reverse sorted array
    arr = [5, 4, 3, 2, 1]
    expected = [1, 2, 3, 4, 5]
    assert merge_sort(arr) == expected

def test_merge_sort_duplicate_elements():
    # Test with duplicate elements
    arr = [5, 2, 8, 2, 9, 1, 5]
    expected = [1, 2, 2, 5, 5, 8, 9]
    assert merge_sort(arr) == expected

def test_merge_sort_large_array():
    # Test with larger array (100 elements)
    import random
    arr = list(range(100, 0, -1))  # Reverse sorted
    expected = list(range(1, 101))  # Should be sorted ascending
    sorted_arr = merge_sort(arr)
    assert sorted_arr == expected
    assert len(sorted_arr) == 100