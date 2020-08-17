const { handlePagination } = require('../../src/utils/handlePagination');


describe('handlePagination', () => {
  it('orders by property appropriately', async () => {
    const results = [
      {
        body: JSON.stringify({
          rows:
            [
              {
                name: 'z',
              },
              {
                name: 'c',
              },
              {
                name: 'a',
              },
            ],
        }),
      },
    ];

    const pagination = {
      orderBy: 'name',
      orderDirection: 'ASC',
      offset: 0,
      limit: 2,
      responseKey: 0,
    };

    const output = handlePagination(results, pagination);
    const body = JSON.parse(output[0].body).rows;
    const { total } = JSON.parse(output[0].body);
    expect(body.length <= pagination.limit).toEqual(true);

    expect(body[0].name).toEqual('a');
    expect(body[1].name).toEqual('c');
    expect(total).toEqual(3);
  });

  it('orders by property appropriately when descending', async () => {
    const results = [
      {
        body: JSON.stringify({
          rows:
            [
              {
                name: 'z',
              },
              {
                name: 'c',
              },
              {
                name: 'a',
              },
            ],
        }),
      },
    ];

    const pagination = {
      orderBy: 'name',
      orderDirection: 'DESC',
      offset: 0,
      limit: 2,
      responseKey: 0,
    };

    const output = handlePagination(results, pagination);
    const body = JSON.parse(output[0].body).rows;
    const { total } = JSON.parse(output[0].body);
    expect(body.length <= pagination.limit).toEqual(true);

    expect(body[0].name).toEqual('z');
    expect(body[1].name).toEqual('c');
    expect(total).toEqual(3);
  });
});
