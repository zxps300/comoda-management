from multiprocessing import Pool

def square(x):
    return x * x

# On Windows, you MUST protect the entry point
if __name__ == '__main__':
    numbers = [1,2,3,4,5,6,7,8]

    # Create a pool of 4 worker processes
    with Pool(4) as p:
        result = p.map(square, numbers)

    print(result)
