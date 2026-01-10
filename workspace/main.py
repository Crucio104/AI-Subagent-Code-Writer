def main():
    # Example test cases
    test_cases = [
        [64, 34, 25, 12, 22, 11, 90],
        [5, 2, 8, 1, 9],
        [1],
        [],
        [3, 3, 3, 3],
        [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
    ]
    
    for i, test in enumerate(test_cases, 1):
        sorted_arr = merge_sort(test)
        print(f"Test {i}: {test} -> {sorted_arr}")


if __name__ == "__main__":
    main()