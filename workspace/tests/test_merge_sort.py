# filename: tests/test_merge_sort.py
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
from algorithms.merge_sort import merge_sort


def test_empty_array():
    assert merge_sort([]) == []


def test_single_element():
    assert merge_sort([42]) == [42]


def test_sorted_array():
    assert merge_sort([1, 2, 3, 4, 5]) == [1, 2, 3, 4, 5]


def test_reverse_sorted_array():
    assert merge_sort([5, 4, 3, 2, 1]) == [1, 2, 3, 4, 5]


def test_duplicate_elements():
    assert merge_sort([3, 3, 3, 3]) == [3, 3, 3, 3]


def test_mixed_numbers():
    assert merge_sort([64, 34, 25, 12, 22, 11, 90]) == [11, 12, 22, 25, 34, 64, 90]


def test_main_script_behavior():
    # Run main.py and parse output to verify sorting works as expected
    import subprocess
    import re

    # Run the main script
    result = subprocess.run(['python', 'main.py'], capture_output=True, text=True)
    
    # Extract all numbers from the output (using regex)
    all_nums = [int(x) for x in re.findall(r'-?\d+', result.stdout)]
    
    # Verify that the test cases from main.py were processed
    # We expect 6 test cases, each with 2 arrays: original and sorted
    # So 12 numbers total from test cases, plus 2 more for the final output?
    # Actually, we expect 6 test cases, each with 7 numbers (original) and 7 (sorted) → 14 per test case? 
    # But wait — the output is: "Test 1: [64, 34, 25, 12, 22, 11, 90] -> [11, 12, 22, 25, 34, 64, 90]"
    # So for each test, we have 14 numbers: 7 original + 7 sorted.
    # 6 test cases → 84 numbers total.
    assert len(all_nums) >= 84
    
    # We can extract the first test case's original and sorted arrays
    # We know test cases are 6 items, so split into 6 groups of 14 numbers
    test_case_count = 6
    expected_count = test_case_count * 14  # 6 test cases, each with 7 original + 7 sorted = 14 numbers
    
    assert len(all_nums) >= expected_count
    
    # Extract test case 1: original and sorted
    original_arr = all_nums[:7]  # first 7 numbers are original
    sorted_arr = all_nums[7:14]  # next 7 numbers are sorted
    
    # Verify they match
    assert sorted_arr == sorted(original_arr)
    
    # Also, verify the test case 1 is correct
    assert original_arr == [64, 34, 25, 12, 22, 11, 90]
    assert sorted_arr == [11, 12, 22, 25, 34, 64, 90]
    
    # Now check test case 2: [5, 2, 8, 1, 9] → [1, 2, 5, 8, 9]
    # Extract the next test case
    next_test_case_start = 14
    next_original_arr = all_nums[next_test_case_start:next_test_case_start+7]
    next_sorted_arr = all_nums[next_test_case_start+7:next_test_case_start+14]
    
    assert next_original_arr == [5, 2, 8, 1, 9]
    assert next_sorted_arr == [1, 2, 5, 8, 9]
    
    # Check test case 3: [1] → [1]
    next_test_case_start = 21
    next_original_arr = all_nums[next_test_case_start:next_test_case_start+7]
    next_sorted_arr = all_nums[next_test_case_start+7:next_test_case_start+14]
    
    assert next_original_arr == [1]
    assert next_sorted_arr == [1]
    
    # Check test case 4: [] → []
    next_test_case_start = 22
    next_original_arr = all_nums[next_test_case_start:next_test_case_start+7]
    next_sorted_arr = all_nums[next_test_case_start+7:next_test_case_start+14]
    
    assert next_original_arr == []
    assert next_sorted_arr == []
    
    # Check test case 5: [3, 3, 3, 3] → [3, 3, 3, 3]
    next_test_case_start = 23
    next_original_arr = all_nums[next_test_case_start:next_test_case_start+7]
    next_sorted_arr = all_nums[next_test_case_start+7:next_test_case_start+14]
    
    assert next_original_arr == [3, 3, 3, 3]
    assert next_sorted_arr == [3, 3, 3, 3]
    
    # Check test case 6: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1] → [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    next_test_case_start = 24
    next_original_arr = all_nums[next_test_case_start:next_test_case_start+7]
    next_sorted_arr = all_nums[next_test_case_start+7:next_test_case_start+14]
    
    assert next_original_arr == [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
    assert next_sorted_arr == [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]