import RoutePresenter from './presenters/route-presenter';
import FilterPresenter from './presenters/filter-presenter';
import {render, RenderPosition} from './framework/render';
import PointsModel from './models/points-model';
import OffersModel from './models/offers-model';
import DestinationsModel from './models/destinations-model';
import FilterModel from './models/filter-model';
import NewEventButtonView from './views/new_event_button/new-event-button-view';
import PointsApiService from './services/api/points-api-service';
import OffersApiService from './services/api/offers-api-service';
import DestinationsApiService from './services/api/destinations-api-service';
import HeaderView from './views/header/header-view';

const AUTHORIZATION = 'Basic ljsu4yhgj4i4u4a4';
const END_POINT = 'https://17.ecmascript.pages.academy/big-trip';

const pageBodyContainerElement = document.querySelector('.page-body');
const headerContainer = new HeaderView();
render(headerContainer, pageBodyContainerElement, RenderPosition.AFTERBEGIN);
const tripMainElement = document.querySelector('.trip-main');
const pointsModel = new PointsModel(new PointsApiService(END_POINT, AUTHORIZATION));
const offersModel = new OffersModel(new OffersApiService(END_POINT, AUTHORIZATION));
const destinationsModel = new DestinationsModel(new DestinationsApiService(END_POINT, AUTHORIZATION));
const filterModel = new FilterModel();
const routePresenter = new RoutePresenter(pageBodyContainerElement, pointsModel, offersModel, filterModel, destinationsModel);
const filterPresenter = new FilterPresenter(tripMainElement, filterModel, pointsModel);
const newPointButtonComponent = new NewEventButtonView();

const handleNewPointFormClose = () => {
  newPointButtonComponent.element.disabled = false;
};

const handleNewPointButtonClick = () => {
  routePresenter.createPoint(handleNewPointFormClose);
  newPointButtonComponent.element.disabled = true;
};

filterPresenter.init();
routePresenter.init();

offersModel.init().then(() => {
  destinationsModel.init().then(() => {
    pointsModel.init().then(() => {
      render(newPointButtonComponent, tripMainElement);
      newPointButtonComponent.setClickHandler(handleNewPointButtonClick);
    });
  });
});
