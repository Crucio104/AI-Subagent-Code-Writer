# filename: tests/test_merge_sort.py
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
from merge_sort import merge_sort

def test_merge_sort_basic():
    arr = [38, 27, 43, 3, 9, 82, 10]
    expected = [3, 9, 10, 27, 38, 43, 82]
    assert merge_sort(arr) == expected

def test_merge_sort_single_element():
    arr = [42]
    expected = [42]
    assert merge_sort(arr) == expected

def test_merge_sort_empty():
    arr = []
    expected = []
    assert merge_sort(arr) == expected

def test_merge_sort_already_sorted():
    arr = [1, 2, 3, 4, 5]
    expected = [1, 2, 3, 4, 5]
    assert merge_sort(arr) == expected

def test_merge_sort_reverse_sorted():
    arr = [5, 4, 3, 2, 1]
    expected = [1, 2, 3, 4, 5]
    assert merge_sort(arr) == expected

def test_merge_sort_with_duplicates():
    arr = [4, 2, 2, 8, 3, 3, 1]
    expected = [1, 2, 2, 3, 3, 4, 8]
    assert merge_sort(arr) == expected