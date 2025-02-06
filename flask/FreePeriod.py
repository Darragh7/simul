# This function will take in a calender matrix and return a list of free periods
def freePeriod(calenderMatrix):

    #Aggregates all the free periods in the calender matrix
    freePeriods = []

    for i in range(0, len(calenderMatrix)):

        for j in range(0, len(calenderMatrix[i])):

            if calenderMatrix[i][j] == 1:

                #Append to a list of free periods
                freePeriods.append([i, j])

    return freePeriods



johnCalender = [1, 0, 0, 1, 1, 0, 1, 1, 0, 1]

example = freePeriod(johnCalender)

print(example)