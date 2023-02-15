import client from '../../../network/Apollo';
import Queries from '../../../network/Queries';

export const getTotalGuests = async (accessGrantId: string) => {
  const res = await client.query({
    query: Queries.GET_TOTAL_GUESTS_FROM_AG_METADATA,
    variables: {accessGrantId},
  });

  return res.data.getAccessGrantGuestCounters;
};
