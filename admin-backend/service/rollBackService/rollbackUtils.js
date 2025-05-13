// utils/rollbackUtils.js

function buildRollbackFilter(search = {}, allowedFields = []) {
  const matchConditions = {
    bet_count: { $gt: 0 }
  };

  if (search && typeof search === "object") {
    const filteredSearch = Object.fromEntries(
      Object.entries(search).filter(
        ([key, value]) =>
          allowedFields.includes(key) &&
          value !== undefined &&
          value !== null &&
          value !== ""
      )
    );

    if (filteredSearch.is_rollback === 1) {
      matchConditions.is_rollback = 1;
      matchConditions.is_result_declared = 0;
    } else if (filteredSearch.is_rollback === 0) {
      matchConditions.is_result_declared = 1;
    } else {
      matchConditions.$or = [
        { is_rollback: 1 },
        { is_result_declared: 1 }
      ];
    }

    for (const [key, value] of Object.entries(filteredSearch)) {
      if (key !== 'is_rollback') {
        matchConditions[key] = value;
      }
    }
  } else {
    matchConditions.$or = [
      { is_rollback: 1 },
      { is_result_declared: 1 }
    ];
  }

  return matchConditions;
}

function rollbackQuery(matchConditions, skip = 0, limit = 10, fieldsToProject = {}) {
  const sort = { result_settled_at: -1 };

  return [
    { $match: matchConditions },
    {
      $project: {
        ...fieldsToProject,
        button: {
          $cond: {
            if: { $eq: ["$is_result_declared", 1] },
            then: "Roll Back",
            else: ""
          }
        }
      }
    },
    { $sort: sort },
    { $skip: skip },
    { $limit: limit }
  ];
}

module.exports = {
  buildRollbackFilter,
  rollbackQuery
};
