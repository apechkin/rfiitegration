module.exports = function(app) {

  /**
   * Create user order and send post request to RFI bank
   *
   * @param {object} req Request object
   * @param {object} res Response object
   * @param {function} next Next function
   *
   * @return {object} Promise
   */
  function createOrder(req, res, next) {
    const user = req.requestedUser;
    const formTracks = req.body.formTracks;
    if(_.isEmpty(formTracks)) {
      return next(new Errors.Bad());
    }
    // cоздание записей в таблице
    return sequelize.transaction((t) => {
      const transaction = {transaction: t};
      return user.createOrder({}, transaction)
      .then((order) => {
        let orderId = order.orderId;
        return Promise.props({
          orderItems: createAllOrderItems(formTracks, orderId, transaction),
          orderId: orderId,
        });
      }).then((result) => {
        let costAmount = 0;
        const {orderItems, orderId} = result;
        orderItems.forEach((ordeItem) => {
          costAmount += parseFloat(ordeItem.paymAmt);
        });
        // составление тела запроса
        const postData = _.assign({}, req.body, {
          key: orderOptions.key,
          cost: costAmount,
          name: 'Order #' + orderId,
          default_email: orderOptions.defaultEmail,
          order_id: orderId,
          comment: 'Paid for track',
        });

        request({
          method: 'POST',
          url: 'https://partner.rficb.ru/alba/input',
          body: postData,
          json: true,
        }, function(err, remoteResponse, remoteBody) {
            if (err) {
              return res.status(500).end('Error');
            }
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end(remoteBody);
        });
      });
    }).catch((err) => {
      next(err);
    });
  }

  return {
    createOrder: createOrder
  }
}
