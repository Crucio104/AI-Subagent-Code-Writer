# filename: tests/test_ciao.py
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
from ciao import merge_sort


def test_merge_sort_empty():
    assert merge_sort([]) == []


def test_merge_sort_single_element():
    assert merge_sort([42]) == [42]


def test_merge_sort_sorted():
    assert merge_sort([1, 2, 3, 4, 5]) == [1, 2, 3, 4, 5]


def test_merge_sort_reverse_sorted():
    assert merge_sort([5, 4, 3, 2, 1]) == [1, 2, 3, 4, 5]


def test_merge_sort_duplicate_elements():
    assert merge_sort([3, 1, 4, 1, 5]) == [1, 1, 3, 4, 5]


def test_merge_sort_mixed():
    assert merge_sort([64, 34, 25, 12, 22, 11, 90]) == [11, 12, 22, 25, 34, 64, 90]


def test_merge_sort_large():
    # Test with a larger array to ensure performance and correctness
    arr = list(range(10, 0, -1))
    sorted_arr = merge_sort(arr)
    assert sorted_arr == list(range(1, 11))