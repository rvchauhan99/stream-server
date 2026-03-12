
const GenericMaster = require('../models/genericMaster');
const data = require('./tags.json');

console.log("Category  Inserttion  calleldd");

let insertmany = async () => {
    try {
        console.log("Category  Inserttion  calleldd");
        let result = await GenericMaster.insertMany(data);
        console.log(result);
    } catch (error) {
        console.log(error);
    }
}
let getAll = async () => {
    try {
        let result = await GenericMaster.find({});
        console.log(result);
    } catch (error) {
        console.log(error);
    }
}

let findDuplicated = async () => {
    try {
        let result = await GenericMaster.aggregate([
            {
                "$group": {
                    "_id": {
                        "key": "$key",
                        "value": "$value"
                    },
                    "count": {
                        "$sum": 1
                    },
                    "duplicates": {
                        "$push": "$_id"
                    }
                }
            },
            {
                "$match": {
                    "count": {
                        "$gt": 1
                    }
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "key": "$_id.key",
                    "value": "$_id.value",
                    "duplicate_count": "$count",
                    "duplicate_ids": "$duplicates"
                }
            }
        ]);
        console.log(result);
    } catch (error) {
        console.log(error);
    }
}
// insertmany();
// getAll();
findDuplicated();