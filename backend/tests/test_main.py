# filename: tests/test_main.py
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
from merge_sort import merge_sort


def test_merge_sort_basic():
    arr = [64, 34, 25, 12, 22, 11, 90]
    sorted_arr = merge_sort(arr)
    assert sorted_arr == [11, 12, 22, 25, 34, 64, 90]


def test_merge_sort_empty():
    arr = []
    sorted_arr = merge_sort(arr)
    assert sorted_arr == []


def test_merge_sort_single_element():
    arr = [42]
    sorted_arr = merge_sort(arr)
    assert sorted_arr == [42]


def test_merge_sort_already_sorted():
    arr = [1, 2, 3, 4, 5]
    sorted_arr = merge_sort(arr)
    assert sorted_arr == [1, 2, 3, 4, 5]


def test_merge_sort_reverse_sorted():
    arr = [5, 4, 3, 2, 1]
    sorted_arr = merge_sort(arr)
    assert sorted_arr == [1, 2, 3, 4, 5]


def test_merge_sort_with_duplicates():
    arr = [4, 2, 2, 8, 3, 3, 1]
    sorted_arr = merge_sort(arr)
    assert sorted_arr == [1, 2, 2, 3, 3, 4, 8]


def test_merge_sort_with_negative_numbers():
    arr = [-3, -1, 0, 2, -4, 5]
    sorted_arr = merge_sort(arr)
    assert sorted_arr == [-4, -3, -1, 0, 2, 5]