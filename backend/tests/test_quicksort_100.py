# filename: tests/test_quicksort_100.py
import pytest
import subprocess
import re

def test_quicksort_100():
    # Run the script and capture output
    result = subprocess.run(['python', 'quicksort_100.py'], capture_output=True, text=True)
    
    # Extract all numbers from stdout using regex
    all_nums = [int(x) for x in re.findall(r'-?\d+', result.stdout)]
    
    # The output should contain:
    # 1. Original array (100 numbers)
    # 2. Sorted array (100 numbers)
    # Total: 200 numbers
    assert len(all_nums) >= 200, f"Expected at least 200 numbers, got {len(all_nums)}"
    
    # Split into original and sorted arrays
    original_array = all_nums[:100]
    sorted_array = all_nums[100:200]
    
    # Check that original array is not sorted (since it's random)
    assert not all(original_array[i] <= original_array[i+1] for i in range(len(original_array)-1))
    
    # Check that sorted array is sorted
    assert all(sorted_array[i] <= sorted_array[i+1] for i in range(len(sorted_array)-1))
    
    # Optional: Verify the script runs without error
    assert result.returncode == 0, "Script failed to run successfully"