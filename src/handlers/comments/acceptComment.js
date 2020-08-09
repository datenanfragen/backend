async function acceptComment(request, h) {
    return await request.server.methods
        .knex('comments')
        .where({
            id: request.params.id,
            accept_token: request.params.token,
            is_accepted: false,
        })
        .update('is_accepted', true)
        .then((count) => {
            if (count < 1) {
                return h
                    .response({
                        message:
                            'Accepting the comment failed. Is the token incorrect or has the comment been accepted already?',
                    })
                    .code(500);
            }

            return {
                message: 'Successfully accepted comment.',
            };
        })
        .catch((e) => {
            console.error(e);
            return h.response({ message: 'Error while accepting the comment.' }).code(500);
        });
}

module.exports = acceptComment;
