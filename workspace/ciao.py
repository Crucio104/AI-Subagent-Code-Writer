def merge_sort(arr):
    """Sorts an array using the merge sort algorithm"""
    if len(arr) <= 1:
        return arr
    
    # Divide the array into two halves
    mid = len(arr) // 2
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])
    
    # Merge the sorted halves
    return merge(left, right)

def merge(left, right):
    """Merges two sorted lists into one sorted list"""
    result = []
    i = j = 0
    
    # Compare elements from both lists and add smaller one to result
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            result.append(left[i])
            i += 1
        else:
            result.append(right[j])
            j += 1
    
    # Add remaining elements (if any)
    while i < len(left):
        result.append(left[i])
        i += 1
    
    while j < len(right):
        result.append(right[j])
        j += 1
    
    return result

# Example usage (optional, for demonstration)
if __name__ == "__main__":
    # You can add test cases here if needed
    test_array = [64, 34, 25, 12, 22, 11, 90]
    sorted_array = merge_sort(test_array)
    print(f"Original: {test_array}")
    print(f"Sorted: {sorted_array}")