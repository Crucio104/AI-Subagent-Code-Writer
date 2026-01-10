def merge_sort(arr):
    """
    Sorts an array using the merge sort algorithm.
    Returns a new sorted array.
    """
    if len(arr) <= 1:
        return arr
    
    # Divide: split the array into two halves
    mid = len(arr) // 2
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])
    
    # Conquer: merge the sorted halves
    return merge(left, right)


def merge(left, right):
    """
    Merges two sorted arrays into one sorted array.
    """
    result = []
    i = j = 0
    
    # Compare elements from both arrays and add smaller one to result
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            result.append(left[i])
            i += 1
        else:
            result.append(right[j])
            j += 1
    
    # Append remaining elements (if any)
    result.extend(left[i:])
    result.extend(right[j:])
    
    return result