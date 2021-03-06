import UiBlocker from '../framework/ui-blocker/ui-blocker';
import EventsListView from '../views/events_list/events-list-view';
import SortFormView from '../views/sort_form/sort-form-view';
import SortAndEventsContainerView from '../views/sort_and_events_container/sort-and-events-container-view';
import EventsListEmptyView from '../views/events_list_empty/events-list-empty-view';
import {remove, render, RenderPosition} from '../framework/render';
import PointPresenter from './point-presenter';
import PointNewPresenter from './point-new-presenter';
import {filter} from '../utils/filter';
import {SortType, UserAction, UpdateType, FilterType} from '../consts';
import {sortPriceDown, sortTimeDown, sortDateDown} from '../utils/utils';
import MainView from '../views/main/main-view';
import MainInnerContainerView from '../views/main_inner_container/main-inner-container-view';
import TripInfoView from '../views/trip_info/trip-info-view';

const TimeLimit = {
  LOWER_LIMIT: 200,
  UPPER_LIMIT: 1000,
};

export default class RoutePresenter {
  #pageBodyContainer = null;
  #pointsModel = null;
  #offersModel = null;
  #destinationsModel = null;
  #filterModel = null;
  #LOADING = 'loading';
  #tripMainElement = null;
  #tripInfoElement = null;

  #sortAndEventsContainer = new SortAndEventsContainerView(); // section class="trip-events"
  #eventsListContainer = new EventsListView();                // ul      class="trip-events__list"
  #sortComponent = null;                                      // form    class="trip-events__trip-sort  trip-sort"
  #noPoinstComponent = null;                                  // p       class="trip-events__msg">
  #loadingComponent = new EventsListEmptyView(this.#LOADING);
  #mainContainer = new MainView();
  #mainInnerContainer = new MainInnerContainerView();

  #pointPresenters = new Map();
  #pointNewPresenter = null;
  #currentSortType = SortType.DAY;
  #filterType = FilterType.EVERYTHING;
  #isLoading = true;
  #uiBlocker = new UiBlocker(TimeLimit.LOWER_LIMIT, TimeLimit.UPPER_LIMIT);

  constructor(pageBodyContainer, pointsModel, offersModel, filterModel, destinationsModel) {
    this.#pageBodyContainer = pageBodyContainer;
    this.#pointsModel = pointsModel;
    this.#offersModel = offersModel;
    this.#destinationsModel = destinationsModel;
    this.#filterModel = filterModel;
    this.#tripMainElement = document.querySelector('.trip-main');

    this.#pointNewPresenter = new PointNewPresenter (this.#eventsListContainer.element, this.#handleViewAction, this.#offersModel.offers, this.#destinationsModel.destinations);

    //#handleModelEvent ?????? ????????????????????-??????????????????????, ?????????????? ?????????? ?????????????????????? ???? ?????????????????? ?? ???????????? ????????????, ??.??. ?????????? ????????????
    this.#pointsModel.addObserver(this.#handleModelEvent);
    this.#filterModel.addObserver(this.#handleModelEvent);
  }

  //?????????? (????????????) ?????? ?????????????????? ???????????? ?? ?????????? ???? ???????????? PointsModel
  get points() {
    this.#filterType = this.#filterModel.filter;
    const points = this.#pointsModel.points;
    const filteredPoints = filter[this.#filterType](points);

    switch (this.#currentSortType) {
      case SortType.TIME:
        return filteredPoints.sort(sortTimeDown);
      case SortType.PRICE:
        return filteredPoints.sort(sortPriceDown);
      case SortType.DAY:
        return filteredPoints.sort(sortDateDown);
    }

    return filteredPoints;
  }

  //?????????? ?????? ?????????????????? ?????????????????????????????? ?????????? ???????????????? ???????????? ???? ????????
  //???????????????????? ?????? ????????, ?????????? ???????????????? ?? ?????????????? ???? ???????????????????????????? ?????? ???????????????? ???? ?? tripInfoElement
  get filteredPoints() {
    this.#filterType = this.#filterModel.filter;
    const points = this.#pointsModel.points;
    const filteredPoints = filter[this.#filterType](points);

    switch (SortType.DAY) {
      case SortType.DAY:
        return filteredPoints.sort(sortDateDown);
    }

    return filteredPoints;
  }

  //?????????? (????????????) ?????? ?????????????????? ???????????? ?? ???????????????????????????? ???????????????????????? ???? ???????????? OffersModel
  get offers() {
    return this.#offersModel.offers;
  }

  get destinations() {
    return this.#destinationsModel.destinations;
  }

  init () {
    this.#renderBoard();
  }

  createPoint = (callback) => {
    this.#currentSortType = SortType.DAY;
    this.#filterModel.setFilter(UpdateType.MAJOR, FilterType.EVERYTHING);
    this.#pointNewPresenter.init(callback, this.#offersModel.offers, this.#destinationsModel.destinations);
  };

  //??????????-???????????????????? ?????? "????????????????????????" ???????? ????????
  #handleModeChange = () => {
    this.#pointNewPresenter.destroy();
    this.#pointPresenters.forEach((presenter) => presenter.resetView());
  };

  //??????????-???????????????????? ?????? ???????????????????????? ???????????????????? View (??.??. ?????? ???????????????? ?????????????????? ?????????????????????????? ?? ????????????????)// ?????????? ?????????? ???????????????? ???????????????????? ????????????.
  // actionType - ???????????????? ????????????????????????, ?????????? ?????????? ????????????, ?????????? ?????????? ???????????? ??????????????
  // updateType - ?????? ??????????????????, ?????????? ?????????? ????????????, ?????? ?????????? ?????????? ????????????????
  // update - ?????????????????????? ????????????
  #handleViewAction = async (actionType, updateType, update) => {
    this.#uiBlocker.block();

    switch (actionType) {
      case UserAction.UPDATE_POINT:
        this.#pointPresenters.get(update.id).setSaving(update);
        try {
          await this.#pointsModel.updatePoint(updateType, update);
        } catch(err) {
          this.#pointPresenters.get(update.id).setAborting(update, this.offers, this.destinations);
        }
        break;
      case UserAction.ADD_POINT:
        this.#pointNewPresenter.setSaving(update, this.offers, this.destinations);
        try {
          await this.#pointsModel.addPoint(updateType, update);
        } catch(err) {
          this.#pointNewPresenter.setAborting(update, this.offers, this.destinations);
        }
        break;
      case UserAction.DELETE_POINT:
        this.#pointPresenters.get(update.id).setDeleting(update);
        try {
          await this.#pointsModel.deletePoint(updateType, update);
        } catch(err) {
          this.#pointPresenters.get(update.id).setAborting(update, this.offers, this.destinations);
        }
        break;
    }

    this.#uiBlocker.unblock();
  };

  //??????????-???????????????????? ?????? ???????????????????????? ???????????????????? ???????????? ?? Model
  #handleModelEvent = (updateType, data) => {
    // ?? ?????????????????????? ???? ???????? ?????????????????? ????????????, ?????? ????????????:
    switch (updateType) {
      case UpdateType.PATCH:
        // - ???????????????? ?????????? ???????????? (????????????????, ?????????? ?????????? ???????????????? ???????????????? ?? ??????????????????)
        this.#pointPresenters.get(data.id).init(data, this.offers, this.destinations);
        break;
      case UpdateType.MINOR:
        // - ???????????????? ???????????? (????????????????, ?????? ???????????????? ?????????? ????????????????)
        this.#clearBoard();
        this.#renderBoard();
        break;
      case UpdateType.MAJOR:
        // - ???????????????? ?????? ?????????? (????????????????, ?????? ???????????????????????? ??????????????)
        this.#clearBoard({resetSortType: true});
        this.#renderBoard();
        break;
      case UpdateType.INIT:
        // - ???????????????? ???????????????????????????? ?????????????????? ?? ???????????????? ???????????????? ???????????????? ???????????? ?? ??????????????
        this.#isLoading = false;
        remove(this.#loadingComponent);
        this.#renderBoard();
        break;
      default:
        throw new Error ('The transferred update type does not exist');
    }
  };

  //?????????? ?????? ???????????????????? ?????????? ????????????????. ?????????? ???? ?????????????? ??????????????????????: ????????????????????, ?????????????? ????????????, ?????????????????? ???????????? ????????????
  #handleSortTypeChange = (sortType) => {
    if (this.#currentSortType === sortType) {
      return;
    }

    // - ?????????????????? ????????????
    this.#currentSortType = sortType;
    // - ?????????????? ????????????
    this.#clearBoard();
    // - ???????????????? ???????????? ????????????
    this.#renderBoard();
  };

  //?????????? ?????????????????? ???????????????????? ???????????????????????????? ?????????????????????? ?? header
  #renderTripInfo () {
    this.#tripInfoElement = new TripInfoView(this.filteredPoints, this.offers);
    render(this.#tripInfoElement, this.#tripMainElement, RenderPosition.AFTERBEGIN);
  }

  //?????????? ?????????????????? ???????????????????? ????????????????????
  #renderSort () {
    this.#sortComponent = new SortFormView(this.#currentSortType);
    this.#sortComponent.setSortTypeChangeHandler(this.#handleSortTypeChange);
    render(this.#sortComponent, this.#sortAndEventsContainer.element);
  }

  //?????????? ?????????????????? ???????????????????? ???????????? <ul>, ?? ?????????????? ?????????? ???????????????? ???????? ?????????? ???????????????? ???????? ???????????????????????????? ?????????????????? ?????? ???????????????? ????????????
  #renderPointsOrInfoContainer () {
    render(this.#eventsListContainer, this.#sortAndEventsContainer.element);
  }

  //?????????? ?????????????????? ???????????????????? ?????????? ????????????????
  #renderPoint (point, offers, destinations) {
    const pointPresenter = new PointPresenter(this.#eventsListContainer.element, this.#handleViewAction, this.#handleModeChange);
    pointPresenter.init(point, offers, destinations);
    this.#pointPresenters.set(point.id, pointPresenter);
  }

  #renderLoading () {
    render (this.#loadingComponent, this.#sortAndEventsContainer.element);
  }

  //?????????? ?????????????????? ???????????????????? ?????????????????????????????? ?????????????????? ???? ???????????????????? ?????????? ????????????????
  #renderNoPoints () {
    this.#noPoinstComponent = new EventsListEmptyView(this.#filterType);
    render(this.#noPoinstComponent, this.#sortAndEventsContainer.element);
  }

  //?????????? ?????? ?????????????? ?????????????????????????? (??????????), ??.??. ???????? ????????????????
  #clearBoard = ({resetSortType = false} = {}) => {
    this.#pointNewPresenter.destroy();
    this.#pointPresenters.forEach((presenter) => presenter.destroy());
    this.#pointPresenters.clear();

    remove(this.#sortComponent);
    remove(this.#loadingComponent);

    if (this.#noPoinstComponent) {
      remove(this.#noPoinstComponent);
    }

    if (resetSortType) {
      this.#currentSortType = SortType.DAY;
    }
  };

  //?????????? ?????????????????? ?????????????????????????? (??????????), ??.??. ???????? ????????????????
  #renderBoard () {
    if (this.#tripInfoElement) {
      remove(this.#tripInfoElement);
    }
    this.#renderTripInfo();

    render(this.#mainContainer, this.#pageBodyContainer);
    render(this.#mainInnerContainer, this.#mainContainer.element);
    render(this.#sortAndEventsContainer, this.#mainInnerContainer.element);
    if (this.#isLoading) {
      this.#renderLoading();
      return;
    }

    this.#renderSort();
    this.#renderPointsOrInfoContainer();

    if (!this.points.length) {
      this.#renderNoPoints();
      return;
    }

    this.points.forEach((element, index) => {
      this.#renderPoint(this.points[index], this.offers, this.destinations);
    });
  }
}
