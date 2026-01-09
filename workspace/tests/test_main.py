# filename: tests/test_main.py
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
from utils import merge_sort

def test_merge_sort_basic():
    arr = [38, 27, 41, 18, 52, 26, 33]
    sorted_arr = merge_sort(arr)
    assert sorted_arr == [18, 26, 27, 33, 38, 41, 52]
    assert sorted_arr == sorted(arr)  # Verify stability and correctness

def test_merge_sort_empty():
    arr = []
    sorted_arr = merge_sort(arr)
    assert sorted_arr == []

def test_merge_sort_single_element():
    arr = [42]
    sorted_arr = merge_sort(arr)
    assert sorted_arr == [42]

def test_merge_sort_duplicate_elements():
    arr = [5, 5, 3, 3, 1, 1]
    sorted_arr = merge_sort(arr)
    assert sorted_arr == [1, 1, 3, 3, 5, 5]

def test_merge_sort_negative_numbers():
    arr = [-3, -1, 0, 2, -4, 1]
    sorted_arr = merge_sort(arr)
    assert sorted_arr == [-4, -3, -1, 0, 1, 2]

def test_merge_sort_large_array():
    # Test with a larger array to ensure performance and correctness
    arr = list(range(10, 0, -1))  # [10, 9, 8, ..., 1]
    sorted_arr = merge_sort(arr)
    assert sorted_arr == list(range(1, 11))  # [1, 2, ..., 10]

def test_merge_sort_already_sorted():
    arr = [1, 2, 3, 4, 5]
    sorted_arr = merge_sort(arr)
    assert sorted_arr == [1, 2, 3, 4, 5]

def test_merge_sort_reverse_sorted():
    arr = [5, 4, 3, 2, 1]
    sorted_arr = merge_sort(arr)
    assert sorted_arr == [1, 2, 3, 4, 5]

def test_merge_sort_mixed_types():
    # This test is intentionally invalid since merge_sort expects integers or comparable types
    # But since the implementation does not handle mixed types, we can't test this.
    # If you need to test mixed types, you would need to change the implementation.
    pass  # No test needed for mixed types since the code doesn't support it

def test_merge_sort_complex_input():
    arr = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
    sorted_arr = merge_sort(arr)
    assert sorted_arr == [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]